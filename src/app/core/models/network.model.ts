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

/** Debe coincidir con MeasurementSource del backend: la latencia HTTP y el ping ICMP no se mezclan. */
export type MeasurementSource = 'native' | 'web';

/** Medición real que entrega el comando Tauri measure_network_quality. */
export interface NetworkQualityMeasurement {
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
}

/** Mientras calibra el modelo no evalúa nada, para no dar falsos positivos. */
export interface AnomalyDetectionStatus {
  /** unknown_network: la última medición no tiene red identificada y no cuenta para ninguna. */
  status: 'calibrating' | 'active' | 'unknown_network';
  samplesCollected: number;
  samplesRequired: number;
}
