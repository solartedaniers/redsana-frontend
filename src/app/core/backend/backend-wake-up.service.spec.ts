import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BACKEND_HEALTH_URL } from './backend-endpoints';
import { BackendWakeUpService } from './backend-wake-up.service';

function setup(platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PLATFORM_ID, useValue: platform }],
  });
  return { service: TestBed.inject(BackendWakeUpService), http: TestBed.inject(HttpTestingController) };
}

describe('BackendWakeUpService', () => {
  it('pide el health liviano del backend una sola vez', () => {
    const { service, http } = setup();

    service.wakeUp();

    http.expectOne({ method: 'GET', url: BACKEND_HEALTH_URL }).flush({ status: 'ok' });
    http.verify();
  });

  it('si el backend no responde no lanza ni muestra nada', () => {
    const { service, http } = setup();

    service.wakeUp();

    expect(() =>
      http.expectOne(BACKEND_HEALTH_URL).flush('', { status: 502, statusText: 'Bad Gateway' }),
    ).not.toThrow();
    http.verify();
  });

  it('al prerenderizar no hace ninguna petición', () => {
    const { service, http } = setup('server');

    service.wakeUp();

    http.verify();
  });
});
