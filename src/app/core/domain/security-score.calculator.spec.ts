import { FALLBACK_SECURITY_SCORE_CONFIG } from '../security-score-config/security-score-config.config';
import { getRecommendationUrgency, getSecurityScoreBand } from './security-score.calculator';

describe('security score display helpers', () => {
  it('con el respaldo, los rangos son los de siempre: bueno desde 80 y regular desde 50', () => {
    const bands = [100, 80, 79, 50, 49, 0].map((score) => getSecurityScoreBand(score, FALLBACK_SECURITY_SCORE_CONFIG));

    expect(bands).toEqual(['good', 'good', 'warning', 'warning', 'critical', 'critical']);
  });

  it('los rangos siguen a la configuración del backend', () => {
    const config = { ...FALLBACK_SECURITY_SCORE_CONFIG, goodMin: 90, warningMin: 60 };

    expect([90, 89, 60, 59].map((score) => getSecurityScoreBand(score, config))).toEqual([
      'good',
      'warning',
      'warning',
      'critical',
    ]);
  });

  it('agrupa las prioridades reales (1 = más urgente) en tres niveles de urgencia', () => {
    expect([1, 2, 3, 4, 5].map(getRecommendationUrgency)).toEqual(['high', 'high', 'medium', 'low', 'low']);
  });
});
