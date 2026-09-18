export type NetworkStatus = 'good' | 'warning' | 'critical' | 'unknown';

export interface NetworkMetricSnapshot {
  status: NetworkStatus;
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  updatedAt: string;
}

export interface NetworkMetricSample {
  timestamp: string;
  latencyMs: number;
}

/** Medición real de calidad de red producida por el comando Tauri measure_network_quality. */
export interface NetworkQualityMeasurement {
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
}
