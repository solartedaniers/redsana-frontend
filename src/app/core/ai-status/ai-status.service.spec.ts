import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AiAvailability } from '../models/ai.model';
import { AiStatusRepository } from '../repositories/ai-status.repository';
import { AI_STATUS_CONFIG, buildPollDelays } from './ai-status.config';
import { AiStatusService } from './ai-status.service';

const DELAYS = buildPollDelays(AI_STATUS_CONFIG);

function setup(
  statuses: Array<AiAvailability | Error>,
  options: { warmUp?: () => Observable<AiAvailability>; platform?: 'browser' | 'server'; authenticated?: boolean } = {}
) {
  const isAuthenticated = signal(options.authenticated ?? true);
  let call = 0;
  const repository = {
    warmUp: vi.fn(options.warmUp ?? (() => of<AiAvailability>('warming_up'))),
    getStatus: vi.fn(() => {
      const next = statuses[Math.min(call++, statuses.length - 1)];
      return next instanceof Error ? throwError(() => next) : of(next);
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
    const { service, repository } = setup(['ready'], { warmUp: () => of<AiAvailability>('ready') });

    vi.advanceTimersByTime(60_000);

    expect(service.status()).toBe('ready');
    expect(repository.getStatus).not.toHaveBeenCalled();
  });

  it('los errores de red mientras despierta el backend cuentan como encendiendo, no como fallo', () => {
    const { service } = setup([new Error('502'), 'ready'], { warmUp: () => throwError(() => new Error('0 Unknown Error')) });

    expect(service.status()).toBe('warming_up');
    vi.advanceTimersByTime(DELAYS[0] + DELAYS[1]);

    expect(service.status()).toBe('ready');
  });

  it('agotado el tope de intentos queda no disponible y deja de consultar', () => {
    const { service, repository } = setup(['warming_up']);

    vi.advanceTimersByTime(AI_STATUS_CONFIG.maxWaitMs + 60_000);

    expect(service.status()).toBe('unavailable');
    expect(repository.getStatus).toHaveBeenCalledTimes(DELAYS.length);
  });

  it('si el backend dice no disponible se detiene enseguida', () => {
    const { service, repository } = setup(['unavailable']);

    vi.advanceTimersByTime(AI_STATUS_CONFIG.maxWaitMs);

    expect(service.status()).toBe('unavailable');
    expect(repository.getStatus).toHaveBeenCalledOnce();
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

  it('al prerenderizar no arranca nada', () => {
    const { service, repository } = setup(['ready'], { platform: 'server' });

    expect(service.status()).toBe('idle');
    expect(repository.warmUp).not.toHaveBeenCalled();
  });
});
