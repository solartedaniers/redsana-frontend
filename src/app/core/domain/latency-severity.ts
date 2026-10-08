// Intentional mirror of LATENCY_WARNING_MS / LATENCY_CRITICAL_MS in
// backend/app/domain/network_status.py: there is no shared code between Angular
// and Python, so if the thresholds change there they must be synced here.
export const LATENCY_THRESHOLDS_MS = {
  warning: 80,
  critical: 150,
} as const;

/** 'cut': no reply at all. aggregateLatencySamples (and ping.rs) report a
 * latency of 0 when every probe was lost, so a 0 ms sample is an outage. */
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
