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
