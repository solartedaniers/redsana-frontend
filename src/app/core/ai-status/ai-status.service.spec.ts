import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, defer, map, of, throwError, timer } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AiAvailability, AiStatusReport } from '../models/ai.model';
import { AiStatusRepository } from '../repositories/ai-status.repository';
import { AI_STATUS_CONFIG, buildPollDelays } from './ai-status.config';
import { AiStatusService } from './ai-status.service';

const DELAYS = buildPollDelays(AI_STATUS_CONFIG);

const report = (status: AiAvailability, reason?: AiStatusReport['reason']): AiStatusReport => ({ status, reason });

function setup(
  statuses: Array<AiAvailability | AiStatusReport | Error>,
  options: { warmUp?: () => Observable<AiStatusReport>; platform?: 'browser' | 'server'; authenticated?: boolean } = {}
) {
  const isAuthenticated = signal(options.authenticated ?? true);
  let call = 0;
  const repository = {
    warmUp: vi.fn(options.warmUp ?? (() => of(report('warming_up')))),
    getStatus: vi.fn((): Observable<AiStatusReport> => {
      const next = statuses[Math.min(call++, statuses.length - 1)];
      if (next instanceof Error) {
        return throwError(() => next);
      }
      return of(typeof next === 'string' ? report(next) : next);
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AiStatusRepository, useValue: repository },
      { provide: AuthService, useValue: { isAuthenticated } },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
    ],
  });
  const service = TestBed.inject(AiStatusService);
  service.start();
  TestBed.tick();
  return { service, repository, isAuthenticated };
}

describe('AiStatusService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sin sesión no despierta nada y queda en reposo', () => {
    const { service, repository } = setup(['ready'], { authenticated: false });

    expect(service.status()).toBe('idle');
    expect(repository.warmUp).not.toHaveBeenCalled();
  });

  it('al iniciar sesión pide el calentamiento y pasa a lista cuando el backend lo dice', () => {
    const { service, repository } = setup(['warming_up', 'ready']);

    expect(repository.warmUp).toHaveBeenCalledOnce();
    expect(service.status()).toBe('warming_up');

    vi.advanceTimersByTime(DELAYS[0]);
    expect(service.status()).toBe('warming_up');
    vi.advanceTimersByTime(DELAYS[1]);

    expect(service.status()).toBe('ready');
    expect(service.isReady()).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(repository.getStatus).toHaveBeenCalledTimes(2);
  });

  it('si el calentamiento ya responde lista no consulta más', () => {
    const { service, repository } = setup(['ready'], { warmUp: () => of(report('ready')) });

    vi.advanceTimersByTime(60_000);

    expect(service.status()).toBe('ready');
    expect(repository.getStatus).not.toHaveBeenCalled();
  });

  it('los errores de red mientras despierta el backend cuentan como encendiendo, no como fallo', () => {
    const { service } = setup([new Error('502'), 'ready']);

    expect(service.status()).toBe('warming_up');
    vi.advanceTimersByTime(DELAYS[0] + DELAYS[1]);

    expect(service.status()).toBe('ready');
  });

  it('si el backend dormido no recibe el pedido de calentamiento, lo repite hasta que llega', () => {
    // Cada suscripción es una petición nueva, como con HttpClient.
    let requests = 0;
    const { service, repository } = setup(['ready'], {
      warmUp: () =>
        defer(() => (++requests < 3 ? throwError(() => new Error('0 Unknown Error')) : of(report('warming_up')))),
    });

    vi.advanceTimersByTime(DELAYS[0] + DELAYS[1]);
    expect(requests).toBe(3);
    expect(repository.getStatus).not.toHaveBeenCalled();
    expect(service.status()).toBe('warming_up');

    vi.advanceTimersByTime(DELAYS[0]);
    expect(service.status()).toBe('ready');
  });

  it('agotado el tope de intentos queda no disponible y deja de consultar', () => {
    const { service, repository } = setup(['warming_up']);

    vi.advanceTimersByTime(AI_STATUS_CONFIG.maxWaitMs + 60_000);

    // Solo las consultas que caben antes del tope de reloj; después ya no consulta más.
    const pollsWithinCap = DELAYS.filter((_, i) => DELAYS.slice(0, i + 1).reduce((a, b) => a + b, 0) < AI_STATUS_CONFIG.maxWaitMs).length;
    expect(service.status()).toBe('unavailable');
    expect(repository.getStatus).toHaveBeenCalledTimes(pollsWithinCap);
  });

  it('el tope es de reloj: con consultas lentas (servicio dormido) no se pasa de la espera máxima', () => {
    const { service, repository } = setup([]);
    // Cada consulta tarda lo que el timeout de estado del backend con el servicio dormido.
    repository.getStatus.mockImplementation(() => timer(5_000).pipe(map(() => report('warming_up'))));

    vi.advanceTimersByTime(AI_STATUS_CONFIG.maxWaitMs - 1);
    expect(service.status()).toBe('warming_up');
    vi.advanceTimersByTime(1);

    expect(service.status()).toBe('unavailable');
  });

  it('si el backend dice no disponible se detiene enseguida y guarda el motivo', () => {
    const { service, repository } = setup([report('unavailable', 'timed_out')]);

    vi.advanceTimersByTime(AI_STATUS_CONFIG.maxWaitMs);

    expect(service.status()).toBe('unavailable');
    expect(service.unavailableReason()).toBe('timed_out');
    expect(service.notReadyKey()).toBe('timed_out');
    expect(repository.getStatus).toHaveBeenCalledOnce();
  });

  it('un backend anterior que no envía motivo cuenta como problema del servicio', () => {
    const { service } = setup(['unavailable']);

    vi.advanceTimersByTime(DELAYS[0]);

    expect(service.unavailableReason()).toBe('service_error');
  });

  it('si se agota la espera del frontend, el motivo es que tardó demasiado', () => {
    const { service } = setup(['warming_up']);

    vi.advanceTimersByTime(AI_STATUS_CONFIG.maxWaitMs);

    expect(service.unavailableReason()).toBe('timed_out');
  });

  it('al abrir el chat con la IA lista la vuelve a pedir sin mostrar encendiendo si el backend confirma', () => {
    const { service, repository } = setup(['ready']);
    vi.advanceTimersByTime(DELAYS[0]);
    repository.warmUp.mockImplementation(() => of(report('ready')));
    const setStatus = vi.spyOn(service.status, 'set');

    service.wakeUp();

    expect(repository.warmUp).toHaveBeenCalledTimes(2);
    expect(setStatus).not.toHaveBeenCalledWith('warming_up');
    expect(service.status()).toBe('ready');
  });

  it('al abrir el chat con la IA dormida muestra encendiendo cuando el backend lo dice', () => {
    const { service, repository } = setup(['ready', 'ready']);
    vi.advanceTimersByTime(DELAYS[0]);

    service.wakeUp();
    expect(service.status()).toBe('warming_up');
    vi.advanceTimersByTime(DELAYS[0]);

    expect(repository.warmUp).toHaveBeenCalledTimes(2);
    expect(service.status()).toBe('ready');
  });

  it('abrir el chat mientras ya se enciende no pide otro calentamiento', () => {
    const { service, repository } = setup(['warming_up']);

    service.wakeUp();

    expect(repository.warmUp).toHaveBeenCalledOnce();
  });

  it('reintentar vuelve a despertar la IA desde cero', () => {
    const { service, repository } = setup(['unavailable', 'ready']);
    vi.advanceTimersByTime(DELAYS[0]);
    expect(service.status()).toBe('unavailable');

    service.retry();
    expect(service.status()).toBe('warming_up');
    vi.advanceTimersByTime(DELAYS[0]);

    expect(repository.warmUp).toHaveBeenCalledTimes(2);
    expect(service.status()).toBe('ready');
  });

  it('cerrar sesión cancela las consultas pendientes y vuelve a reposo', () => {
    const { service, repository, isAuthenticated } = setup(['warming_up']);

    isAuthenticated.set(false);
    TestBed.tick();
    vi.advanceTimersByTime(AI_STATUS_CONFIG.maxWaitMs);

    expect(service.status()).toBe('idle');
    expect(repository.getStatus).not.toHaveBeenCalled();
  });

  it('si el chat avisa que la IA se durmió, la despierta otra vez', () => {
    const { service, repository } = setup(['ready', 'ready']);
    vi.advanceTimersByTime(DELAYS[0]);
    expect(service.status()).toBe('ready');

    service.reportWarmingUp();

    expect(service.status()).toBe('warming_up');
    expect(repository.warmUp).toHaveBeenCalledTimes(2);
  });

  it('si tarda más de lo normal en encender, avisa que puede tardar y lo quita al quedar lista', () => {
    const { service, repository } = setup(['warming_up']);

    vi.advanceTimersByTime(AI_STATUS_CONFIG.slowNoticeAfterMs - 1);
    expect(service.isTakingLong()).toBe(false);
    expect(service.notReadyKey()).toBe('warming_up');

    vi.advanceTimersByTime(1);
    expect(service.isTakingLong()).toBe(true);
    expect(service.notReadyKey()).toBe('warming_up_slow');

    repository.getStatus.mockImplementation(() => of(report('ready')));
    vi.advanceTimersByTime(AI_STATUS_CONFIG.slowNoticeAfterMs);
    expect(service.status()).toBe('ready');
    expect(service.isTakingLong()).toBe(false);
  });

  it('al prerenderizar no arranca nada', () => {
    const { service, repository } = setup(['ready'], { platform: 'server' });

    expect(service.status()).toBe('idle');
    expect(repository.warmUp).not.toHaveBeenCalled();
  });
});
