import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AiWarmingUpError } from '../ai-status/ai-warming-up.error';
import { SecurityAssistantHttpRepository } from './security-assistant-http.repository';

function setup() {
  TestBed.configureTestingModule({ providers: [SecurityAssistantHttpRepository, provideHttpClient(), provideHttpClientTesting()] });
  return { repository: TestBed.inject(SecurityAssistantHttpRepository), http: TestBed.inject(HttpTestingController) };
}

describe('SecurityAssistantHttpRepository con la IA encendiendo', () => {
  it('el chat convierte el 503 "ai_warming_up" en AiWarmingUpError', () => {
    const { repository, http } = setup();
    let error: unknown;

    repository.sendMessage('c1', 'hola').subscribe({ error: (e) => (error = e) });
    http.expectOne(() => true).flush({ detail: 'ai_warming_up' }, { status: 503, statusText: 'Service Unavailable' });

    expect(error).toBeInstanceOf(AiWarmingUpError);
  });

  it('el resumen también lo convierte', () => {
    const { repository, http } = setup();
    let error: unknown;

    repository.startAssessmentBriefing('a1', 'es').subscribe({ error: (e) => (error = e) });
    http.expectOne(() => true).flush({ detail: 'ai_warming_up' }, { status: 503, statusText: 'Service Unavailable' });

    expect(error).toBeInstanceOf(AiWarmingUpError);
  });

  it('un fallo real del asistente (502) sigue siendo un error normal', () => {
    const { repository, http } = setup();
    let error: unknown;

    repository.sendMessage('c1', 'hola').subscribe({ error: (e) => (error = e) });
    http.expectOne(() => true).flush({ detail: 'Chat engine unavailable' }, { status: 502, statusText: 'Bad Gateway' });

    expect(error).not.toBeInstanceOf(AiWarmingUpError);
  });
});
