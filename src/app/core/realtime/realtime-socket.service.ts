import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subscription,
  combineLatest,
  defer,
  distinctUntilChanged,
  from,
  fromEvent,
  map,
  retry,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { supabaseClient } from '../auth/supabase-client';
import { LIVE_UPDATES_CONFIG, reconnectDelayMs } from './live-updates.config';
import { LiveUpdates, RealtimeEvent } from './live-updates';

/** Cierres tras los que reintentar no sirve: logout, Origin rechazado y cuenta suspendida. */
const FINAL_CLOSE_CODES: ReadonlySet<number> = new Set([1000, 1008, 4403]);
const EVENT_TYPES: ReadonlySet<string> = new Set([
  'measurement.created',
  'alert.created',
  'devices.updated',
  'ai.status.changed',
]);
const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const CLIENT_CLOSE_CODE = 1000;

export const WEB_SOCKET_FACTORY = new InjectionToken<(url: string) => WebSocket>('WEB_SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => new WebSocket(url),
});

/** El mismo token que pone el interceptor HTTP; supabase-js lo renueva solo antes de que venza. */
export const REALTIME_ACCESS_TOKEN = new InjectionToken<() => Promise<string | null>>('REALTIME_ACCESS_TOKEN', {
  providedIn: 'root',
  factory: () => async () => (await supabaseClient.auth.getSession()).data.session?.access_token ?? null,
});

/** Cada token nuevo que supabase-js obtiene al renovar la sesión (lo hace solo, antes de que venza). */
export const REALTIME_TOKEN_REFRESHES = new InjectionToken<Observable<string>>('REALTIME_TOKEN_REFRESHES', {
  providedIn: 'root',
  factory: () =>
    new Observable<string>((subscriber) => {
      const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' && session) {
          subscriber.next(session.access_token);
        }
      });
      return () => data.subscription.unsubscribe();
    }),
});

class SocketClosed extends Error {
  constructor(
    readonly code: number,
    readonly wasStable: boolean,
  ) {
    super(`realtime socket closed with ${code}`);
  }
}

/**
 * Un socket por pestaña, abierto solo con sesión y con la pestaña visible. Si se cae, la app sigue sondeando por REST
 * y se reintenta con espera creciente. Nunca cierra la sesión: un 4401 solo pide reconectar con el token vigente.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeSocketService {
  private readonly auth = inject(AuthService);
  private readonly liveUpdates = inject(LiveUpdates);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly createSocket = inject(WEB_SOCKET_FACTORY);
  private readonly accessToken = inject(REALTIME_ACCESS_TOKEN);
  private readonly tokenRefreshes = inject(REALTIME_TOKEN_REFRESHES);
  private readonly isAuthenticated$ = toObservable(this.auth.isAuthenticated);
  private readonly url = `${environment.apiBaseUrl.replace(/^http/, 'ws')}/api/realtime/ws`;
  private failedAttempts = 0;

  start(): void {
    // Al prerenderizar no hay sesión ni pestaña.
    if (!this.isBrowser) {
      return;
    }
    const visible$ = fromEvent(this.document, 'visibilitychange').pipe(
      startWith(null),
      map(() => this.document.visibilityState === 'visible'),
      distinctUntilChanged(),
      tap((visible) => this.liveUpdates.setVisible(visible)),
    );
    combineLatest([this.isAuthenticated$, visible$])
      .pipe(
        map(([isAuthenticated, visible]) => isAuthenticated && visible),
        distinctUntilChanged(),
        switchMap((active) => (active ? this.connectWithRetries() : EMPTY)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.deliver(event));
  }

  private connectWithRetries(): Observable<RealtimeEvent> {
    this.failedAttempts = 0;
    return defer(() => this.connectOnce()).pipe(
      retry({
        delay: (error: unknown) => {
          if (error instanceof SocketClosed && error.wasStable) {
            this.failedAttempts = 0;
          }
          return timer(reconnectDelayMs(this.failedAttempts++, LIVE_UPDATES_CONFIG));
        },
      }),
    );
  }

  private connectOnce(): Observable<RealtimeEvent> {
    return from(this.accessToken()).pipe(switchMap((token) => (token ? this.openSocket(token) : EMPTY)));
  }

  private openSocket(token: string): Observable<RealtimeEvent> {
    return new Observable<RealtimeEvent>((subscriber) => {
      const socket = this.createSocket(this.url);
      let liveSince: number | null = null;
      let renewals: Subscription | undefined;
      const finish = (code: number): void => {
        const wasStable = liveSince !== null && Date.now() - liveSince >= LIVE_UPDATES_CONFIG.stableConnectionMs;
        if (FINAL_CLOSE_CODES.has(code)) {
          subscriber.complete();
        } else {
          subscriber.error(new SocketClosed(code, wasStable));
        }
      };
      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
      socket.onmessage = (message: MessageEvent) => {
        const parsed = parseMessage(message.data);
        if (parsed?.['type'] === 'ready') {
          liveSince = Date.now();
          // El token renovado se manda por el mismo socket: así no hay que reconectar cuando vence el anterior.
          renewals ??= this.tokenRefreshes.subscribe((renewed) =>
            socket.send(JSON.stringify({ type: 'auth', token: renewed })),
          );
          this.liveUpdates.setLive(true);
          this.liveUpdates.resync();
        } else if (parsed?.['type'] === 'close' && typeof parsed['code'] === 'number') {
          // El servidor avisa el código antes de cerrar porque en Render el frame de cierre no llega (el navegador
          // vería 1006 unos 20 s después). Cerrar este lado lo hace la limpieza de abajo.
          finish(parsed['code']);
        } else if (isRealtimeEvent(parsed)) {
          subscriber.next(parsed);
        }
      };
      // Sin aviso previo (1006 incluido) es una caída de la red o del servidor: se reintenta.
      socket.onclose = (event: CloseEvent) => finish(event.code);
      return () => {
        socket.onopen = socket.onmessage = socket.onclose = null;
        renewals?.unsubscribe();
        this.liveUpdates.setLive(false);
        if (socket.readyState === SOCKET_CONNECTING || socket.readyState === SOCKET_OPEN) {
          socket.close(CLIENT_CLOSE_CODE);
        }
      };
    });
  }

  /** El admin recibe los eventos de todos los hogares; las pantallas de aquí solo muestran su propia red. */
  private deliver(event: RealtimeEvent): void {
    if (event.owner_id === null || event.owner_id === this.auth.currentUser()?.id) {
      this.liveUpdates.publish(event);
    }
  }
}

function parseMessage(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(data);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isRealtimeEvent(message: Record<string, unknown> | null): message is Record<string, unknown> & RealtimeEvent {
  return message !== null && typeof message['type'] === 'string' && EVENT_TYPES.has(message['type']);
}
