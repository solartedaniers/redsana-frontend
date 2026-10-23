import { PLATFORM_ID, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { FALLBACK_NETWORK_STATUS_THRESHOLDS } from './network-thresholds.config';
import { NetworkThresholdsService } from './network-thresholds.service';

const URL_SUFFIX = '/api/network-metrics/thresholds';
const BACKEND = { latency_warning_ms: 100, latency_critical_ms: 200, packet_loss_warning_percent: 2, packet_loss_critical_percent: 8 };

function setup(options: { authenticated?: boolean; platform?: 'browser' | 'server' } = {}) {
  const isAuthenticated = signal(options.authenticated ?? true);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated } },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
    ],
  });
  const service = TestBed.inject(NetworkThresholdsService);
  service.start();
  TestBed.tick();
  return { service, http: TestBed.inject(HttpTestingController), isAuthenticated };
}

describe('NetworkThresholdsService', () => {
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

  it('al prerenderizar no hace ninguna petición', () => {
    const { http } = setup({ platform: 'server' });

    http.verify();
  });
});
