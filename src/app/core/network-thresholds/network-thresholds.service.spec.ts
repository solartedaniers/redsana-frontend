import { PLATFORM_ID, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { MeasurementSource } from '../models/network.model';
import { NetworkMeasurementGateway } from '../network-measurement/network-measurement.gateway';
import { RuntimeEnvironmentService } from '../runtime/runtime-environment.service';
import { FALLBACK_NETWORK_STATUS_THRESHOLDS, FALLBACK_ROUTER_DIAGNOSIS_LIMITS } from './network-thresholds.config';
import { NetworkThresholdsService } from './network-thresholds.service';

const URL_SUFFIX = '/api/network-metrics/thresholds';
const BACKEND = {
  latency_warning_ms: 100,
  latency_critical_ms: 200,
  packet_loss_warning_percent: 2,
  packet_loss_critical_percent: 8,
};

function setup(
  options: {
    authenticated?: boolean;
    platform?: 'browser' | 'server';
    source?: MeasurementSource;
    desktop?: boolean;
  } = {},
) {
  const isAuthenticated = signal(options.authenticated ?? true);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated } },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      { provide: NetworkMeasurementGateway, useValue: { source: options.source ?? 'web' } },
      { provide: RuntimeEnvironmentService, useValue: { isDesktop: options.desktop ?? false } },
    ],
  });
  const service = TestBed.inject(NetworkThresholdsService);
  service.start();
  TestBed.tick();
  return { service, http: TestBed.inject(HttpTestingController), isAuthenticated };
}

describe('NetworkThresholdsService', () => {
  it('la web pide los umbrales de sus propias mediciones (source=web)', () => {
    const { http } = setup({ source: 'web' });

    expect(http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).request.params.get('source')).toBe('web');
  });

  it('el escritorio pide los del ping nativo (source=native)', () => {
    const { http } = setup({ source: 'native' });

    expect(http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).request.params.get('source')).toBe('native');
  });

  it('antes de responder el backend usa los de respaldo', () => {
    const { service } = setup();

    expect(service.thresholds()).toEqual(FALLBACK_NETWORK_STATUS_THRESHOLDS);
  });

  it('al haber sesión pide los umbrales una vez y los comparte', () => {
    const { service, http } = setup();

    http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush(BACKEND);
    http.verify();

    expect(service.thresholds()).toEqual({
      latencyWarningMs: 100,
      latencyCriticalMs: 200,
      packetLossWarningPercent: 2,
      packetLossCriticalPercent: 8,
    });
  });

  it('con un backend anterior (404) se queda con el respaldo sin fallar', () => {
    const { service, http } = setup();

    http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush('Not Found', { status: 404, statusText: 'Not Found' });
    http.verify();

    expect(service.thresholds()).toEqual(FALLBACK_NETWORK_STATUS_THRESHOLDS);
  });

  it('con el backend dormido (502) o sin red se queda con el respaldo y no reintenta', () => {
    const { service, http } = setup();

    http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).error(new ProgressEvent('error'));
    http.verify();

    expect(service.thresholds()).toEqual(FALLBACK_NETWORK_STATUS_THRESHOLDS);
  });

  it('una respuesta incoherente (advertencia mayor que crítica) no reemplaza al respaldo', () => {
    const { service, http } = setup();

    http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush({ ...BACKEND, latency_warning_ms: 500 });

    expect(service.thresholds()).toEqual(FALLBACK_NETWORK_STATUS_THRESHOLDS);
  });

  it('sin sesión no pide nada; al iniciarla, sí', () => {
    const { http, isAuthenticated } = setup({ authenticated: false });
    http.expectNone((req) => req.url.endsWith(URL_SUFFIX));

    isAuthenticated.set(true);
    TestBed.tick();

    http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush(BACKEND);
    http.verify();
  });

  describe('escritorio: guarda los umbrales para diagnosticar sin conexión', () => {
    const ROUTER_RULE = { gateway_latency_bad_ms: 120, gateway_recent_reply_minutes: 30 };

    beforeEach(() => localStorage.clear());

    it('toma la regla del router de la respuesta y, sin conexión, arranca con lo guardado', () => {
      const online = setup({ desktop: true, source: 'native' });
      online.http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush({ ...BACKEND, ...ROUTER_RULE });
      expect(online.service.routerLimits()).toEqual({ gatewayLatencyBadMs: 120, gatewayRecentReplyMinutes: 30 });

      const offline = setup({ desktop: true, source: 'native', authenticated: false });

      expect(offline.service.thresholds().latencyCriticalMs).toBe(200);
      expect(offline.service.routerLimits().gatewayRecentReplyMinutes).toBe(30);
    });

    it('un backend anterior sin la regla del router deja los valores por defecto', () => {
      const { service, http } = setup({ desktop: true, source: 'native' });

      http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush(BACKEND);

      expect(service.routerLimits()).toEqual(FALLBACK_ROUTER_DIAGNOSIS_LIMITS);
    });

    it('la web no guarda nada en el equipo', () => {
      const { http } = setup({ desktop: false });

      http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush({ ...BACKEND, ...ROUTER_RULE });

      expect(localStorage.length).toBe(0);
    });
  });

  it('al prerenderizar no hace ninguna petición', () => {
    const { http } = setup({ platform: 'server' });

    http.verify();
  });
});
