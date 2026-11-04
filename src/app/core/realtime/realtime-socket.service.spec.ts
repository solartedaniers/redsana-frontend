import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { LIVE_UPDATES_CONFIG, reconnectDelayMs } from './live-updates.config';
import { LiveUpdates } from './live-updates';
import { Subject } from 'rxjs';
import {
  REALTIME_ACCESS_TOKEN,
  REALTIME_TOKEN_REFRESHES,
  RealtimeSocketService,
  WEB_SOCKET_FACTORY,
} from './realtime-socket.service';

class FakeSocket {
  readyState = 0;
  readonly sent: unknown[] = [];
  closedWith: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  send(text: string): void {
    this.sent.push(JSON.parse(text));
  }

  close(code: number): void {
    this.closedWith = code;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: object): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

describe('RealtimeSocketService', () => {
  let sockets: FakeSocket[];
  let visibility: DocumentVisibilityState;
  const isAuthenticated = signal(true);
  const signOut = vi.fn();
  let tokenRefreshes: Subject<string>;

  function start(): LiveUpdates {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated, currentUser: signal({ id: 'me' }), signOut } },
        {
          provide: WEB_SOCKET_FACTORY,
          useValue: () => {
            const socket = new FakeSocket();
            sockets.push(socket);
            return socket;
          },
        },
        { provide: REALTIME_ACCESS_TOKEN, useValue: () => Promise.resolve('token') },
        { provide: REALTIME_TOKEN_REFRESHES, useValue: tokenRefreshes },
      ],
    });
    TestBed.inject(RealtimeSocketService).start();
    TestBed.tick();
    return TestBed.inject(LiveUpdates);
  }

  /** Deja correr la promesa del token, los efectos y los temporizadores vencidos. */
  async function settle(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  }

  async function connectLive(): Promise<FakeSocket> {
    await settle();
    const socket = sockets.at(-1)!;
    socket.open();
    socket.receive({ type: 'ready', server_id: 'a' });
    return socket;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    sockets = [];
    tokenRefreshes = new Subject<string>();
    visibility = 'visible';
    isAuthenticated.set(true);
    signOut.mockClear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('se autentica con el primer mensaje y queda en vivo con ready', async () => {
    const live = start();
    const socket = await connectLive();

    expect(socket.sent).toEqual([{ type: 'auth', token: 'token' }]);
    expect(live.isLive()).toBe(true);
  });

  it('con la pestaña oculta o sin sesión no abre el socket, y al ocultarla lo cierra', async () => {
    visibility = 'hidden';
    const live = start();
    await settle();
    expect(sockets).toHaveLength(0);

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    const socket = await connectLive();
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));

    expect(socket.closedWith).toBe(1000);
    expect(live.isLive()).toBe(false);

    isAuthenticated.set(false);
    await settle();
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await settle(LIVE_UPDATES_CONFIG.maxReconnectDelayMs);
    expect(sockets).toHaveLength(1);
  });

  it('un 1006 sin aviso reintenta con espera creciente y sin bucle rápido aunque llegue a ready', async () => {
    const live = start();
    await connectLive();

    for (const attempt of [0, 1, 2]) {
      sockets.at(-1)!.drop(1006);
      expect(live.isLive()).toBe(false);
      const delay = reconnectDelayMs(attempt, LIVE_UPDATES_CONFIG, () => 1);
      await settle(delay - 1);
      expect(sockets).toHaveLength(attempt + 1);
      await settle(1);
      expect(sockets).toHaveLength(attempt + 2);
      sockets.at(-1)!.open();
      sockets.at(-1)!.receive({ type: 'ready', server_id: 'a' });
    }
    expect(signOut).not.toHaveBeenCalled();
  });

  it('después de estar en vivo un buen rato vuelve a la espera inicial', async () => {
    start();
    await connectLive();
    sockets[0].drop();
    await settle(reconnectDelayMs(0, LIVE_UPDATES_CONFIG, () => 1));
    sockets[1].open();
    sockets[1].receive({ type: 'ready' });

    await settle(LIVE_UPDATES_CONFIG.stableConnectionMs);
    sockets[1].drop();
    await settle(reconnectDelayMs(0, LIVE_UPDATES_CONFIG, () => 1));

    expect(sockets).toHaveLength(3);
  });

  it('el aviso close decide sin esperar el frame: 4401 reconecta sin cerrar la sesión y 4403 no reintenta', async () => {
    start();
    const first = await connectLive();

    first.receive({ type: 'close', code: 4401 });
    expect(first.closedWith).toBe(1000);
    await settle(reconnectDelayMs(0, LIVE_UPDATES_CONFIG, () => 1));
    expect(sockets).toHaveLength(2);
    expect(signOut).not.toHaveBeenCalled();

    sockets[1].open();
    sockets[1].receive({ type: 'close', code: 4403 });
    await settle(LIVE_UPDATES_CONFIG.maxReconnectDelayMs * 2);
    expect(sockets).toHaveLength(2);
  });

  it('al renovarse el token lo manda por el mismo socket, sin reconectar', async () => {
    start();
    const socket = await connectLive();

    tokenRefreshes.next('renewed');

    expect(socket.sent).toEqual([
      { type: 'auth', token: 'token' },
      { type: 'auth', token: 'renewed' },
    ]);
    expect(sockets).toHaveLength(1);
  });

  it('con la pestaña oculta no sondea ni deja un reintento pendiente, y al volver pide todo una vez', async () => {
    const live = start();
    const resyncs: number[] = [];
    live.resyncs().subscribe(() => resyncs.push(1));
    const socket = await connectLive();
    socket.drop();
    expect(live.shouldPoll()).toBe(true);

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await settle(LIVE_UPDATES_CONFIG.maxReconnectDelayMs * 2);
    expect(live.shouldPoll()).toBe(false);
    expect(sockets).toHaveLength(1);

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(resyncs).toHaveLength(2);
    await settle();
    expect(sockets).toHaveLength(2);
  });

  it('solo avisa los eventos propios y los que son para todos', async () => {
    const live = start();
    const measurements: number[] = [];
    const aiChanges: number[] = [];
    live.refreshesFor('measurement.created').subscribe(() => measurements.push(1));
    live.refreshesFor('ai.status.changed').subscribe(() => aiChanges.push(1));
    const socket = await connectLive();
    const base = { v: 1, data: {}, at: '2026-11-04T00:00:00Z' };

    socket.receive({ ...base, type: 'measurement.created', owner_id: 'someone-else' });
    socket.receive({ ...base, type: 'measurement.created', owner_id: 'me' });
    socket.receive({ ...base, type: 'ai.status.changed', owner_id: null });
    socket.receive({ type: 'ping' });

    // El primero de cada lista es el resync de ready.
    expect(measurements).toHaveLength(2);
    expect(aiChanges).toHaveLength(2);
  });
});

describe('reconnectDelayMs', () => {
  it('crece con cada intento, tiene tope y se reparte entre la mitad y el total', () => {
    const highest = [0, 1, 2, 10].map((attempt) => reconnectDelayMs(attempt, LIVE_UPDATES_CONFIG, () => 1));
    expect(highest).toEqual([2_000, 4_000, 8_000, 60_000]);
    expect(reconnectDelayMs(0, LIVE_UPDATES_CONFIG, () => 0)).toBe(1_000);
  });
});
