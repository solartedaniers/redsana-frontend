import { SECURITY_SCORE_WEIGHTS, getRecommendationUrgency } from './security-score.calculator';

describe('security score display helpers', () => {
  it('los pesos del cuestionario y del análisis técnico suman 100, como en el backend', () => {
    expect(SECURITY_SCORE_WEIGHTS.questionnaire + SECURITY_SCORE_WEIGHTS.technical).toBe(100);
  });

  it('agrupa las prioridades reales (1 = más urgente) en tres niveles de urgencia', () => {
    expect([1, 2, 3, 4, 5].map(getRecommendationUrgency)).toEqual(['high', 'high', 'medium', 'low', 'low']);
  });
});
