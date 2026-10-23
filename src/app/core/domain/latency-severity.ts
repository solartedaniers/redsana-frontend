import { NetworkStatusThresholds } from '../network-thresholds/network-thresholds.config';

/** 'cut' es un corte: cuando se pierden todas las muestras la latencia llega como 0 ms. */
export type LatencySeverity = 'healthy' | 'warning' | 'critical' | 'cut';

const SEVERITY_RANK: Record<LatencySeverity, number> = { healthy: 0, warning: 1, critical: 2, cut: 3 };

/**
 * La misma regla que compute_network_status del backend (latencia o pérdida de paquetes), con sus mismos umbrales,
 * para que el gráfico y el estado del dashboard coincidan. Sin pérdida (backend anterior) clasifica solo por latencia.
 */
export function classifyMeasurement(
  latencyMs: number,
  packetLossPercent: number | undefined,
  thresholds: NetworkStatusThresholds
): LatencySeverity {
  if (latencyMs <= 0) {
    return 'cut';
  }
  const loss = packetLossPercent ?? 0;
  if (latencyMs >= thresholds.latencyCriticalMs || loss >= thresholds.packetLossCriticalPercent) {
    return 'critical';
  }
  return latencyMs >= thresholds.latencyWarningMs || loss >= thresholds.packetLossWarningPercent ? 'warning' : 'healthy';
}

export function severityRank(severity: LatencySeverity): number {
  return SEVERITY_RANK[severity];
}

export function worstSeverity(a: LatencySeverity, b: LatencySeverity): LatencySeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}
