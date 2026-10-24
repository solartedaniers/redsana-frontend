import { WifiEncryptionStatus } from '../models/security.model';
import { SecurityScoreConfig } from '../security-score-config/security-score-config.config';

export type SecurityScoreBand = 'good' | 'warning' | 'critical';

// Los rangos son los del backend (SecurityScoreConfigService), para todo lugar que pinte el puntaje de seguridad.
export function getSecurityScoreBand(score: number, config: SecurityScoreConfig): SecurityScoreBand {
  if (score >= config.goodMin) {
    return 'good';
  }
  if (score >= config.warningMin) {
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

export type RecommendationUrgency = 'high' | 'medium' | 'low';

// El backend usa prioridades de 1 (más urgente) a 5; aquí solo las agrupo para mostrarlas.
const URGENCY_MAX_PRIORITY: Record<Exclude<RecommendationUrgency, 'low'>, number> = { high: 2, medium: 3 };

export function getRecommendationUrgency(priority: number): RecommendationUrgency {
  if (priority <= URGENCY_MAX_PRIORITY.high) {
    return 'high';
  }
  return priority <= URGENCY_MAX_PRIORITY.medium ? 'medium' : 'low';
}
