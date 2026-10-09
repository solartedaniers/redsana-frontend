// Copia a propósito de los umbrales de backend/app/domain/network_status.py: si cambian allá, cámbialos aquí.
export const LATENCY_THRESHOLDS_MS = {
  warning: 80,
  critical: 150,
} as const;

/** 'cut' es un corte: cuando se pierden todas las muestras la latencia llega como 0 ms. */
export type LatencySeverity = 'healthy' | 'warning' | 'critical' | 'cut';

const SEVERITY_RANK: Record<LatencySeverity, number> = { healthy: 0, warning: 1, critical: 2, cut: 3 };

export function classifyLatency(latencyMs: number): LatencySeverity {
  if (latencyMs <= 0) {
    return 'cut';
  }
  if (latencyMs >= LATENCY_THRESHOLDS_MS.critical) {
    return 'critical';
  }
  return latencyMs >= LATENCY_THRESHOLDS_MS.warning ? 'warning' : 'healthy';
}

export function worstSeverity(a: LatencySeverity, b: LatencySeverity): LatencySeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}
