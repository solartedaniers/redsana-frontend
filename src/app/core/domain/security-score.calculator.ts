import { WifiEncryptionStatus } from '../models/security.model';

export type SecurityScoreBand = 'good' | 'warning' | 'critical';

// Mismos umbrales para cualquier lugar que pinte el puntaje de seguridad
// (asistente, supervisión de admin) - una sola fuente de verdad.
export function getSecurityScoreBand(score: number): SecurityScoreBand {
  if (score >= 80) {
    return 'good';
  }
  if (score >= 50) {
    return 'warning';
  }
  return 'critical';
}

// Mismo criterio que app/domain/security_assessment.py (backend): sin código
// compartido entre frontend/backend, se duplica el umbral a propósito.
const STRONG_WIFI_ENCRYPTION_PREFIXES = ['WPA3', 'WPA2'];

/** Solo para mostrar el dato en el cuestionario; el score real (que también
 * pondera esto) se calcula en el backend a partir de wifiEncryptionRaw. */
export function evaluateWifiEncryption(raw: string | null): WifiEncryptionStatus {
  if (!raw) {
    return 'unknown';
  }
  const upper = raw.toUpperCase();
  return STRONG_WIFI_ENCRYPTION_PREFIXES.some((prefix) => upper.startsWith(prefix)) ? 'secure' : 'weak';
}

// Intentional mirror of QUESTIONNAIRE_WEIGHT_PERCENT / TECHNICAL_WEIGHT_PERCENT
// in backend/app/services/network_security_score_service.py.
export const SECURITY_SCORE_WEIGHTS = {
  questionnaire: 30,
  technical: 70,
} as const;

export type RecommendationUrgency = 'high' | 'medium' | 'low';

// Backend priorities go from 1 (most urgent) to 5; this only groups them for display.
const URGENCY_MAX_PRIORITY: Record<Exclude<RecommendationUrgency, 'low'>, number> = { high: 2, medium: 3 };

export function getRecommendationUrgency(priority: number): RecommendationUrgency {
  if (priority <= URGENCY_MAX_PRIORITY.high) {
    return 'high';
  }
  return priority <= URGENCY_MAX_PRIORITY.medium ? 'medium' : 'low';
}
