import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  concat,
  concatMap,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  of,
  retry,
  startWith,
  switchMap,
  takeUntil,
  takeWhile,
  timer,
} from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AiAvailability, AiStatusReport, AiUnavailableReason } from '../models/ai.model';
import { AiStatusRepository } from '../repositories/ai-status.repository';
import { LiveUpdates, RealtimeEvent } from '../realtime/live-updates';
import { AiClientWakeUp } from './ai-client-wake-up';
import { AI_STATUS_CONFIG, buildPollDelays } from './ai-status.config';

/** idle: sin sesión no hay IA que mostrar. */
export type AiStatusState = AiAvailability | 'idle';

const WARMING_UP: AiStatusReport = { status: 'warming_up' };
// Si el backend nunca contesta, la espera del frontend es la que se agota.
const TIMED_OUT: AiStatusReport = { status: 'unavailable', reason: 'timed_out' };
// Un backend anterior responde "unavailable" sin motivo: lo trato como problema del servicio.
const DEFAULT_REASON: AiUnavailableReason = 'service_error';

// El calentamiento lo hace el backend; aquí solo se pide y se consulta el estado con backoff. switchMap corta el ciclo
// al cerrar sesión o reintentar, sin dejar consultas vivas.
@Injectable({ providedIn: 'root' })
export class AiStatusService {
  private readonly repository = inject(AiStatusRepository);
  private readonly clientWakeUp = inject(AiClientWakeUp);
  private readonly liveUpdates = inject(LiveUpdates);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly isAuthenticated$ = toObservable(inject(AuthService).isAuthenticated);
  /** Cada valor reinicia el ciclo; true muestra "encendiendo" de inmediato, false espera lo que diga el backend. */
  private readonly restart$ = new Subject<boolean>();
  private readonly pollDelays = buildPollDelays(AI_STATUS_CONFIG);

  readonly status = signal<AiStatusState>('idle');
  readonly unavailableReason = signal<AiUnavailableReason>(DEFAULT_REASON);
  /** Lleva más de slowNoticeAfterMs encendiéndose: se avisa que puede tardar y que se puede seguir usando la app. */
  readonly isTakingLong = signal(false);
  private slowNotice?: Subscription;
  readonly isReady = computed(() => this.status() === 'ready');
  /** La clave del aviso del chat: el estado, o el motivo cuando no está disponible. */
  readonly notReadyKey = computed(() => {
    const status = this.status();
    if (status === 'unavailable') {
      return this.unavailableReason();
    }
    return status === 'warming_up' && this.isTakingLong() ? 'warming_up_slow' : status;
  });

  start(): void {
    // Al prerenderizar no hay sesión ni red, y un temporizador vivo no dejaría terminar el prerender.
    if (!this.isBrowser) {
      return;
    }
    this.isAuthenticated$
      .pipe(
        switchMap((isAuthenticated) =>
          isAuthenticated
            ? this.restart$.pipe(
                startWith(true),
                switchMap((showWarmingUp) => this.warmUpCycle(showWarmingUp)),
              )
            : of<AiStatusReport | null>(null),
        ),
      )
      .subscribe((report) => {
        this.unavailableReason.set(report?.reason ?? DEFAULT_REASON);
        this.trackSlowWarmUp(report?.status === 'warming_up');
        this.status.set(report?.status ?? 'idle');
      });
  }

  /** El botón de reintentar tras "no disponible": inicia un intento completo. */
  retry(): void {
    this.restart$.next(true);
  }

  /** Al abrir el chat: si la IA no está encendiéndose ya, le pido al backend que la despierte. Si estaba lista, el
   * indicador no cambia salvo que el backend diga que se durmió. */
  wakeUp(): void {
    if (this.status() !== 'warming_up') {
      this.restart$.next(this.status() !== 'ready');
    }
  }

  /** El chat recibió "encendiendo": la IA volvió a dormirse, así que la despierto otra vez. */
  reportWarmingUp(): void {
    if (this.status() !== 'warming_up') {
      this.restart$.next(true);
    }
  }

  /** El reloj del aviso corre mientras siga encendiendo, aunque se reinicie el ciclo (p. ej. al abrir el chat). */
  private trackSlowWarmUp(isWarmingUp: boolean): void {
    if (!isWarmingUp) {
      this.slowNotice?.unsubscribe();
      this.slowNotice = undefined;
      this.isTakingLong.set(false);
      return;
    }
    this.slowNotice ??= timer(AI_STATUS_CONFIG.slowNoticeAfterMs).subscribe(() => this.isTakingLong.set(true));
  }

  private warmUpCycle(showWarmingUp: boolean): Observable<AiStatusReport> {
    // Cada ciclo nace de una acción del usuario (sesión, chat, reintentar): también despierto la IA desde aquí.
    this.clientWakeUp.wakeUp();
    // Con el socket en vivo el estado llega solo (ai.status.changed) y salto la consulta de ese turno; si el socket no
    // está, consulto como siempre. Al reconectar pido el estado una vez por si cambió mientras estaba caído.
    const polls$ = from(this.pollDelays).pipe(
      concatMap((delayMs) =>
        timer(delayMs).pipe(switchMap(() => (this.liveUpdates.isLive() ? EMPTY : this.currentStatus()))),
      ),
    );
    const pushed$ = merge(
      this.liveUpdates.eventsOf('ai.status.changed').pipe(
        map(toReport),
        filter((pushed): pushed is AiStatusReport => pushed !== null),
      ),
      this.liveUpdates.resyncs().pipe(switchMap(() => this.currentStatus())),
    );
    // Consultar el estado no despierta nada: si el backend dormido no recibió el pedido, lo repito con la misma espera.
    const warmUp$ = this.repository
      .warmUp()
      .pipe(
        retry({ delay: (_error, attempt) => timer(this.pollDelays[Math.min(attempt, this.pollDelays.length) - 1]) }),
      );
    // El tope es de reloj, no la suma de pausas: con el backend dormido cada petición tarda. Agotado el tiempo queda
    // no disponible (con reintentar); normalmente lo decide antes el backend.
    const waiting$ = merge(concat(showWarmingUp ? of(WARMING_UP) : EMPTY, warmUp$, polls$), pushed$).pipe(
      takeUntil(timer(AI_STATUS_CONFIG.maxWaitMs)),
    );
    return concat(waiting$, of(TIMED_OUT)).pipe(
      takeWhile((report) => report.status === 'warming_up', true),
      distinctUntilChanged(
        (previous, current) => previous.status === current.status && previous.reason === current.reason,
      ),
    );
  }

  private currentStatus(): Observable<AiStatusReport> {
    return this.orWarmingUp(this.repository.getStatus());
  }

  /** Un error de red es lo normal mientras Render despierta el backend: sigo esperando en vez de fallar. */
  private orWarmingUp(source: Observable<AiStatusReport>): Observable<AiStatusReport> {
    return source.pipe(catchError(() => of(WARMING_UP)));
  }
}

const AVAILABILITIES: ReadonlySet<string> = new Set<AiAvailability>(['ready', 'warming_up', 'unavailable']);

/** data de ai.status.changed tiene la forma de /api/ai/status; algo distinto se ignora. */
function toReport(event: RealtimeEvent): AiStatusReport | null {
  const { status, reason } = event.data;
  if (typeof status !== 'string' || !AVAILABILITIES.has(status)) {
    return null;
  }
  return {
    status: status as AiAvailability,
    reason: reason === 'timed_out' || reason === 'service_error' ? reason : null,
  };
}
