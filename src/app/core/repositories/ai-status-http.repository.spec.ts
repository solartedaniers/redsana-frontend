import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AiAvailability } from '../models/ai.model';
import { AiStatusHttpRepository } from './ai-status-http.repository';

function setup() {
  TestBed.configureTestingModule({ providers: [AiStatusHttpRepository, provideHttpClient(), provideHttpClientTesting()] });
  return { repository: TestBed.inject(AiStatusHttpRepository), http: TestBed.inject(HttpTestingController) };
}

describe('AiStatusHttpRepository', () => {
  it('lee el estado de la IA del backend', () => {
    const { repository, http } = setup();
    let status: AiAvailability | undefined;

    repository.getStatus().subscribe((result) => (status = result));
    http.expectOne({ method: 'GET', url: `${environment.apiBaseUrl}/api/ai/status` }).flush({ status: 'warming_up' });

    expect(status).toBe('warming_up');
    http.verify();
  });

  it('pide el calentamiento y devuelve el estado de ese momento', () => {
    const { repository, http } = setup();
    let status: AiAvailability | undefined;

    repository.warmUp().subscribe((result) => (status = result));
    http.expectOne({ method: 'POST', url: `${environment.apiBaseUrl}/api/ai/warm-up` }).flush({ status: 'ready' });

    expect(status).toBe('ready');
    http.verify();
  });

  it('un backend anterior sin estos endpoints tiene la IA en su proceso: la da por lista', () => {
    const { repository, http } = setup();
    let status: AiAvailability | undefined;

    repository.warmUp().subscribe((result) => (status = result));
    http.expectOne(`${environment.apiBaseUrl}/api/ai/warm-up`).flush({ detail: 'Not Found' }, { status: 404, statusText: 'Not Found' });

    expect(status).toBe('ready');
    http.verify();
  });

  it('otros errores (p. ej. el proxy mientras Render despierta) siguen siendo errores', () => {
    const { repository, http } = setup();
    let failed = false;

    repository.getStatus().subscribe({ error: () => (failed = true) });
    http.expectOne(`${environment.apiBaseUrl}/api/ai/status`).flush('', { status: 502, statusText: 'Bad Gateway' });

    expect(failed).toBe(true);
    http.verify();
  });
});
