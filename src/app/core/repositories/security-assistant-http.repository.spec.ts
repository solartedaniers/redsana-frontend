import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AiWarmingUpError } from '../ai-status/ai-warming-up.error';
import { SecurityAssistantHttpRepository } from './security-assistant-http.repository';

function setup() {
  TestBed.configureTestingModule({
    providers: [SecurityAssistantHttpRepository, provideHttpClient(), provideHttpClientTesting()],
  });
  return { repository: TestBed.inject(SecurityAssistantHttpRepository), http: TestBed.inject(HttpTestingController) };
}

describe('SecurityAssistantHttpRepository con la IA encendiendo', () => {
  it('el chat convierte el 503 "ai_warming_up" en AiWarmingUpError', () => {
    const { repository, http } = setup();
    let error: unknown;

    repository.sendMessage('c1', 'hola').subscribe({ error: (e) => (error = e) });
    http
      .expectOne((req) => req.url.endsWith('/api/chat-conversations/c1/messages'))
      .flush({ detail: 'ai_warming_up' }, { status: 503, statusText: 'Service Unavailable' });

    expect(error).toBeInstanceOf(AiWarmingUpError);
  });

  it('el resumen también lo convierte', () => {
    const { repository, http } = setup();
    let error: unknown;

    repository.startAssessmentBriefing('a1', 'es').subscribe({ error: (e) => (error = e) });
    http
      .expectOne((req) => req.url.endsWith('/api/chat-conversations/briefings'))
      .flush({ detail: 'ai_warming_up' }, { status: 503, statusText: 'Service Unavailable' });

    expect(error).toBeInstanceOf(AiWarmingUpError);
  });

  it('un fallo real del asistente (502) sigue siendo un error normal', () => {
    const { repository, http } = setup();
    let error: unknown;

    repository.sendMessage('c1', 'hola').subscribe({ error: (e) => (error = e) });
    http
      .expectOne((req) => req.url.endsWith('/api/chat-conversations/c1/messages'))
      .flush({ detail: 'Chat engine unavailable' }, { status: 502, statusText: 'Bad Gateway' });

    expect(error).not.toBeInstanceOf(AiWarmingUpError);
  });
});

describe('SecurityAssistantHttpRepository: recomendaciones', () => {
  it('cada recomendación trae la clave de "cómo hacerlo" junto a su descripción', () => {
    const { repository, http } = setup();
    let howKeys: string[] = [];

    repository.getLatest().subscribe((result) => (howKeys = result?.recommendations.map((r) => r.howKey) ?? []));
    http
      .expectOne((req) => req.url.endsWith('/api/security-assessments/latest'))
      .flush({
        id: 'a1',
        score: 40,
        questionnaire_score: 40,
        technical_score: null,
        is_partial: true,
        technical_measured_at: null,
        technical_evidence_reused: false,
        submitted_at: '2026-10-24T00:00:00Z',
        recommendations: [
          {
            id: 'change-default-password',
            title_key: 'user.securityAssistant.recommendations.changeDefaultPassword.title',
            description_key: 'user.securityAssistant.recommendations.changeDefaultPassword.description',
            priority: 1,
          },
        ],
      });

    expect(howKeys).toEqual(['user.securityAssistant.recommendations.changeDefaultPassword.how']);
  });
});
