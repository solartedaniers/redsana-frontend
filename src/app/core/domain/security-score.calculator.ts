import { WifiEncryptionStatus } from '../models/security.model';

export type SecurityScoreBand = 'good' | 'warning' | 'critical';

// Umbrales únicos para todo lugar que pinte el puntaje de seguridad.
export function getSecurityScoreBand(score: number): SecurityScoreBand {
  if (score >= 80) {
    return 'good';
  }
  if (score >= 50) {
    return 'warning';
  }
  return 'critical';
}

// Copio a propósito el criterio de app/domain/security_assessment.py porque no hay código compartido.
const STRONG_WIFI_ENCRYPTION_PREFIXES = ['WPA3', 'WPA2'];

/** Solo para mostrarlo en el cuestionario; el puntaje real lo calcula el backend. */
export function evaluateWifiEncryption(raw: string | null): WifiEncryptionStatus {
  if (!raw) {
    return 'unknown';
  }
  const upper = raw.toUpperCase();
  return STRONG_WIFI_ENCRYPTION_PREFIXES.some((prefix) => upper.startsWith(prefix)) ? 'secure' : 'weak';
}

// Copia a propósito de los pesos de app/services/network_security_score_service.py del repo del backend.
export const SECURITY_SCORE_WEIGHTS = {
  questionnaire: 30,
  technical: 70,
} as const;

export type RecommendationUrgency = 'high' | 'medium' | 'low';

// El backend usa prioridades de 1 (más urgente) a 5; aquí solo las agrupo para mostrarlas.
const URGENCY_MAX_PRIORITY: Record<Exclude<RecommendationUrgency, 'low'>, number> = { high: 2, medium: 3 };

export function getRecommendationUrgency(priority: number): RecommendationUrgency {
  if (priority <= URGENCY_MAX_PRIORITY.high) {
    return 'high';
  }
  return priority <= URGENCY_MAX_PRIORITY.medium ? 'medium' : 'low';
}
