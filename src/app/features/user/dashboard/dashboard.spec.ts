import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Subject, config, of, throwError } from 'rxjs';
import { NetworkMetricSnapshot } from '../../../core/models/network.model';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { Dashboard } from './dashboard';
import { LOCAL_DIAGNOSIS_CONFIG } from '../../../core/local-diagnosis/local-diagnosis.config';
import { signal } from '@angular/core';
import { RuntimeEnvironmentService } from '../../../core/runtime/runtime-environment.service';
import {
  LocalDiagnosis,
  LocalNetworkDiagnosisService,
} from '../../../core/local-diagnosis/local-network-diagnosis.service';

describe('Dashboard live snapshot', () => {
  it('deja de sondear al salir de la pantalla (no acumula intervals entre visitas)', () => {
    const snapshots = new Subject<NetworkMetricSnapshot>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: NetworkMetricsRepository,
          useValue: { watchSnapshot: () => snapshots, getHistory: () => of([]), getAnomalyStatus: () => NEVER },
        },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    expect(snapshots.observed).toBe(true);

    fixture.destroy();

    expect(snapshots.observed).toBe(false);
  });
});

describe('Dashboard sin mediciones', () => {
  function render(snapshot: NetworkMetricSnapshot) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: NetworkMetricsRepository,
          useValue: { watchSnapshot: () => of(snapshot), getHistory: () => of([]), getAnomalyStatus: () => NEVER },
        },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('con status unknown muestra "Aún no hay mediciones" y no ceros ni "en vivo"', () => {
    const element = render({
      status: 'unknown',
      latencyMs: 0,
      jitterMs: 0,
      packetLossPercent: 0,
      updatedAt: new Date().toISOString(),
    });

    expect(element.querySelector('app-measurement-empty-state')).not.toBeNull();
    expect(element.querySelector('app-metric-card')).toBeNull();
    expect(element.textContent).not.toContain('user.dashboard.live');
  });

  it('una medición real y reciente sí se marca "en vivo"; una vieja no', () => {
    const recent = render({
      status: 'good',
      latencyMs: 20,
      jitterMs: 2,
      packetLossPercent: 0,
      updatedAt: new Date().toISOString(),
    });
    expect(recent.querySelector('.metric-tile__detail')?.textContent?.trim()).toBe('user.dashboard.live');
    TestBed.resetTestingModule();

    const old = render({
      status: 'good',
      latencyMs: 20,
      jitterMs: 2,
      packetLossPercent: 0,
      updatedAt: '2020-01-01T00:00:00Z',
    });
    expect(old.querySelector('.metric-tile__detail')?.textContent?.trim()).toBe('user.dashboard.lastMeasurement');
  });
  it('una medición de la web se presenta como latencia al servidor, no como estado de la red', () => {
    const element = render({
      status: 'critical',
      latencyMs: 263,
      jitterMs: 116,
      packetLossPercent: 0,
      updatedAt: new Date().toISOString(),
      source: 'web',
    });

    expect(element.querySelector('.status-badge')?.textContent?.trim()).toBe('common.serverLatencyStatus.critical');
    expect(element.querySelector('.status-light .label')?.textContent?.trim()).toBe(
      'common.serverLatencyStatus.critical',
    );
    expect(element.querySelector('.vitals__latency')?.textContent).toContain('user.dashboard.serverLatency');
  });
});

describe('Dashboard con errores del historial o del estado de calibración', () => {
  it('maneja el error: no queda sin manejar, el gráfico sale vacío y el snapshot se sigue mostrando', async () => {
    const unhandled = vi.fn();
    const previous = config.onUnhandledError;
    config.onUnhandledError = unhandled;
    try {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideRouter([]),
          {
            provide: NetworkMetricsRepository,
            useValue: {
              watchSnapshot: () =>
                of({
                  status: 'good',
                  latencyMs: 20,
                  jitterMs: 2,
                  packetLossPercent: 0,
                  updatedAt: new Date().toISOString(),
                }),
              getHistory: () => throwError(() => new Error('502')),
              getAnomalyStatus: () => throwError(() => new Error('502')),
            },
          },
        ],
      });
      const fixture = TestBed.createComponent(Dashboard);
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      const element = fixture.nativeElement as HTMLElement;

      expect(unhandled).not.toHaveBeenCalled();
      expect(element.querySelector('app-history-chart')).not.toBeNull();
      expect(element.querySelector('app-metric-card')).not.toBeNull();
      expect(element.querySelector('.anomaly-calibrating-banner')).toBeNull();
    } finally {
      config.onUnhandledError = previous;
    }
  });
});

describe('Dashboard diagnóstico router / proveedor', () => {
  function render(snapshot: Partial<NetworkMetricSnapshot>) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: NetworkMetricsRepository,
          useValue: {
            watchSnapshot: () =>
              of({
                status: 'critical',
                latencyMs: 300,
                jitterMs: 2,
                packetLossPercent: 0,
                updatedAt: new Date().toISOString(),
                ...snapshot,
              }),
            getHistory: () => of([]),
            getAnomalyStatus: () => NEVER,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('con dato del router (escritorio 0.1.6) muestra el diagnóstico', () => {
    const element = render({ source: 'native', gatewayLatencyMs: 4, diagnosis: 'provider', possibleBusyDevice: false });

    expect(element.querySelector('app-network-diagnosis-panel')?.getAttribute('data-diagnosis')).toBe('provider');
  });

  it('desde la web no muestra diagnóstico', () => {
    expect(render({ source: 'web' }).querySelector('app-network-diagnosis-panel')).toBeNull();
  });

  it('con el instalador 0.1.5 (sin dato del router) no muestra diagnóstico', () => {
    expect(render({ source: 'native', diagnosis: null }).querySelector('app-network-diagnosis-panel')).toBeNull();
  });
});

describe('Dashboard sin conexión con el servidor (escritorio)', () => {
  const T0 = Date.parse('2026-10-24T12:00:00Z');
  const LOCAL_INTERNET_DOWN = {
    diagnosis: 'provider' as const,
    gatewayLatencyMs: 4,
    recordedAt: new Date(T0 + 60_000).toISOString(),
  };

  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  function render(isDesktop: boolean) {
    vi.setSystemTime(T0);
    const local = signal<LocalDiagnosis | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: RuntimeEnvironmentService, useValue: { isDesktop } },
        { provide: LocalNetworkDiagnosisService, useValue: { current: local } },
        {
          provide: NetworkMetricsRepository,
          useValue: {
            // Lo último que llegó del servidor antes del corte: todo bien.
            watchSnapshot: () =>
              of({
                status: 'good',
                latencyMs: 20,
                jitterMs: 1,
                packetLossPercent: 0,
                updatedAt: new Date(T0).toISOString(),
                source: 'native',
                gatewayLatencyMs: 4,
                diagnosis: 'ok',
              }),
            getHistory: () => of([]),
            getAnomalyStatus: () => NEVER,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    return { fixture, local, element: fixture.nativeElement as HTMLElement };
  }

  const panel = (element: HTMLElement) => element.querySelector('app-network-diagnosis-panel');

  it('con el servidor callado, el panel usa la última medición del equipo y lo dice; las tarjetas no cambian', () => {
    const { fixture, local, element } = render(true);

    vi.setSystemTime(T0 + 60_000);
    local.set(LOCAL_INTERNET_DOWN);
    fixture.detectChanges();

    expect(panel(element)?.getAttribute('data-diagnosis')).toBe('provider');
    expect(element.querySelector('.diagnosis__offline')?.textContent).toContain('user.dashboard.diagnosis.offlineNote');
    expect(element.querySelector('app-metric-card')?.textContent).toContain('20');
  });

  it('si el servidor respondió hace poco, manda el diagnóstico del servidor', () => {
    const { fixture, local, element } = render(true);

    vi.setSystemTime(T0 + 5_000);
    local.set({ ...LOCAL_INTERNET_DOWN, recordedAt: new Date(T0 + 5_000).toISOString() });
    fixture.detectChanges();

    expect(panel(element)?.getAttribute('data-diagnosis')).toBe('ok');
    expect(element.querySelector('.diagnosis__offline')).toBeNull();
  });

  it('la web nunca usa el diagnóstico del equipo', () => {
    const { fixture, local, element } = render(false);

    vi.setSystemTime(T0 + 60_000);
    local.set(LOCAL_INTERNET_DOWN);
    fixture.detectChanges();

    expect(panel(element)?.getAttribute('data-diagnosis')).toBe('ok');
    expect(element.querySelector('.diagnosis__offline')).toBeNull();
  });
});

describe('Dashboard abierto durante el corte (escritorio, sin ningún snapshot del servidor)', () => {
  const T0 = Date.parse('2026-10-24T12:00:00Z');
  // La app ya medía desde la bandeja: internet caído, el router responde.
  const MEASURED_BEFORE_OPENING = {
    diagnosis: 'provider' as const,
    gatewayLatencyMs: 4,
    recordedAt: new Date(T0 - 30_000).toISOString(),
  };

  beforeEach(() =>
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] }),
  );
  afterEach(() => vi.useRealTimers());

  function open(isDesktop: boolean, snapshots = new Subject<NetworkMetricSnapshot>()) {
    vi.setSystemTime(T0);
    const local = signal<LocalDiagnosis | null>(MEASURED_BEFORE_OPENING);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: RuntimeEnvironmentService, useValue: { isDesktop } },
        { provide: LocalNetworkDiagnosisService, useValue: { current: local } },
        {
          provide: NetworkMetricsRepository,
          // El servidor no responde: ni snapshot ni historial.
          useValue: { watchSnapshot: () => snapshots, getHistory: () => NEVER, getAnomalyStatus: () => NEVER },
        },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    return { fixture, local, snapshots, element: fixture.nativeElement as HTMLElement };
  }

  const panel = (element: HTMLElement) => element.querySelector('app-network-diagnosis-panel');
  const waitSilence = (fixture: { detectChanges(): void }) => {
    vi.advanceTimersByTime(LOCAL_DIAGNOSIS_CONFIG.serverSilentAfterMs);
    fixture.detectChanges();
  };

  it('al cumplirse el silencio muestra el diagnóstico del equipo con la nota, sin esperar otra medición', () => {
    const { fixture, element } = open(true);

    expect(panel(element)).toBeNull();
    waitSilence(fixture);

    expect(panel(element)?.getAttribute('data-diagnosis')).toBe('provider');
    expect(element.querySelector('.diagnosis__offline')?.textContent).toContain('user.dashboard.diagnosis.offlineNote');
    // Las tarjetas siguen cargando: no hay datos del servidor que mostrar.
    expect(element.querySelector('.vitals[aria-busy="true"]')).not.toBeNull();
    expect(element.querySelector('app-metric-card')).toBeNull();
  });

  it('una medición nueva del equipo durante el corte actualiza el panel', () => {
    const { fixture, local, element } = open(true);
    waitSilence(fixture);

    local.set({
      diagnosis: 'router_unreachable',
      gatewayLatencyMs: null,
      recordedAt: new Date(Date.now()).toISOString(),
    });
    fixture.detectChanges();

    expect(panel(element)?.getAttribute('data-diagnosis')).toBe('router_unreachable');
  });

  it('entrar al panel desde otra pantalla durante el corte también lo muestra', () => {
    const first = open(true);
    waitSilence(first.fixture);
    first.fixture.destroy();
    TestBed.resetTestingModule();

    const { fixture, element } = open(true);
    waitSilence(fixture);

    expect(panel(element)?.getAttribute('data-diagnosis')).toBe('provider');
  });

  it('cuando el servidor vuelve, manda su diagnóstico y desaparece la nota', () => {
    const { fixture, snapshots, element } = open(true);
    waitSilence(fixture);

    snapshots.next({
      status: 'good',
      latencyMs: 14.8,
      jitterMs: 1,
      packetLossPercent: 0,
      updatedAt: new Date(Date.now()).toISOString(),
      source: 'native',
      gatewayLatencyMs: 4,
      diagnosis: 'ok',
    });
    fixture.detectChanges();

    expect(panel(element)?.getAttribute('data-diagnosis')).toBe('ok');
    expect(element.querySelector('.diagnosis__offline')).toBeNull();
  });

  it('la web abierta sin servidor no muestra ningún diagnóstico', () => {
    const { fixture, element } = open(false);
    waitSilence(fixture);

    expect(panel(element)).toBeNull();
  });
});
