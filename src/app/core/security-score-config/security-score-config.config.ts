/** Rangos del puntaje de seguridad y peso de cada parte: los mismos campos que GET /api/security-assessments/score-config. */
export interface SecurityScoreConfig {
  readonly goodMin: number;
  readonly warningMin: number;
  readonly questionnaireWeightPercent: number;
  readonly technicalWeightPercent: number;
}

// Respaldo mientras no llegan los del backend (dormido, caído o anterior al endpoint): sus valores por defecto.
export const FALLBACK_SECURITY_SCORE_CONFIG: SecurityScoreConfig = {
  goodMin: 80,
  warningMin: 50,
  questionnaireWeightPercent: 30,
  technicalWeightPercent: 70,
};
