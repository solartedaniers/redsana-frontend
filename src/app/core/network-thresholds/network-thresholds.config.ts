/** Desde dónde una medición es advertencia o crítica: los mismos campos que GET /api/network-metrics/thresholds. */
export interface NetworkStatusThresholds {
  readonly latencyWarningMs: number;
  readonly latencyCriticalMs: number;
  readonly packetLossWarningPercent: number;
  readonly packetLossCriticalPercent: number;
}

// Respaldo mientras no llegan los del backend (dormido, caído o anterior al endpoint): sus valores por defecto.
/** Regla del router (gateway_latency_bad_ms y gateway_recent_reply_minutes de GET /thresholds); solo el escritorio. */
export interface RouterDiagnosisLimits {
  /** Desde esta latencia al router el problema es el WiFi o el router. */
  readonly gatewayLatencyBadMs: number;
  /** Con internet caído y el router sin responder, se lo culpa solo si respondió en estos últimos minutos. */
  readonly gatewayRecentReplyMinutes: number;
}

/** Los mismos valores por defecto del backend (NETWORK_GATEWAY_*). */
export const FALLBACK_ROUTER_DIAGNOSIS_LIMITS: RouterDiagnosisLimits = {
  gatewayLatencyBadMs: 100,
  gatewayRecentReplyMinutes: 60,
};

export const FALLBACK_NETWORK_STATUS_THRESHOLDS: NetworkStatusThresholds = {
  latencyWarningMs: 80,
  latencyCriticalMs: 150,
  packetLossWarningPercent: 1,
  packetLossCriticalPercent: 5,
};
