/** Desde dónde una medición es advertencia o crítica: los mismos campos que GET /api/network-metrics/thresholds. */
export interface NetworkStatusThresholds {
  readonly latencyWarningMs: number;
  readonly latencyCriticalMs: number;
  readonly packetLossWarningPercent: number;
  readonly packetLossCriticalPercent: number;
}

// Respaldo mientras no llegan los del backend (dormido, caído o anterior al endpoint): sus valores por defecto.
export const FALLBACK_NETWORK_STATUS_THRESHOLDS: NetworkStatusThresholds = {
  latencyWarningMs: 80,
  latencyCriticalMs: 150,
  packetLossWarningPercent: 1,
  packetLossCriticalPercent: 5,
};
