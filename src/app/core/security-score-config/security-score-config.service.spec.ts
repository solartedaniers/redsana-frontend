import { PLATFORM_ID, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { FALLBACK_SECURITY_SCORE_CONFIG } from './security-score-config.config';
import { SecurityScoreConfigService } from './security-score-config.service';

const URL_SUFFIX = '/api/security-assessments/score-config';
const BACKEND = { good_min: 90, warning_min: 60, questionnaire_weight_percent: 40, technical_weight_percent: 60 };

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
  const service = TestBed.inject(SecurityScoreConfigService);
  service.start();
  TestBed.tick();
  return { service, http: TestBed.inject(HttpTestingController), isAuthenticated };
}

describe('SecurityScoreConfigService', () => {
  it('el respaldo son los valores de siempre del backend', () => {
    expect(FALLBACK_SECURITY_SCORE_CONFIG).toEqual({
      goodMin: 80,
      warningMin: 50,
      questionnaireWeightPercent: 30,
      technicalWeightPercent: 70,
    });
  });

  it('antes de responder el backend usa el respaldo', () => {
    const { service } = setup();

    expect(service.config()).toEqual(FALLBACK_SECURITY_SCORE_CONFIG);
  });

  it('al haber sesión pide la configuración una vez y la comparte', () => {
    const { service, http } = setup();

    http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush(BACKEND);
    http.verify();

    expect(service.config()).toEqual({
      goodMin: 90,
      warningMin: 60,
      questionnaireWeightPercent: 40,
      technicalWeightPercent: 60,
    });
  });

  it('con un backend anterior (404) se queda con el respaldo sin fallar', () => {
    const { service, http } = setup();

    http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush('Not Found', { status: 404, statusText: 'Not Found' });
    http.verify();

    expect(service.config()).toEqual(FALLBACK_SECURITY_SCORE_CONFIG);
  });

  it('sin red se queda con el respaldo y no reintenta', () => {
    const { service, http } = setup();

    http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).error(new ProgressEvent('error'));
    http.verify();

    expect(service.config()).toEqual(FALLBACK_SECURITY_SCORE_CONFIG);
  });

  const incoherent: [string, Record<string, number | undefined>][] = [
    ['regular mayor que bueno', { warning_min: 95 }],
    ['bueno mayor que 100', { good_min: 120 }],
    ['regular en 0', { warning_min: 0 }],
    ['pesos que no suman 100', { technical_weight_percent: 50 }],
    ['un campo que falta', { good_min: undefined }],
  ];
  for (const [name, change] of incoherent) {
    it(`una respuesta incoherente (${name}) no reemplaza al respaldo`, () => {
      const { service, http } = setup();

      http.expectOne((req) => req.url.endsWith(URL_SUFFIX)).flush({ ...BACKEND, ...change });

      expect(service.config()).toEqual(FALLBACK_SECURITY_SCORE_CONFIG);
    });
  }

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
