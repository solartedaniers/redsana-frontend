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

/** Debe coincidir con MeasurementSource del backend: el detector de anomalías
 * nunca mezcla fuentes porque la latencia HTTP (web) no es comparable con el ping ICMP (native). */
export type MeasurementSource = 'native' | 'web';

/** Medición real de calidad de red producida por el comando Tauri measure_network_quality. */
export interface NetworkQualityMeasurement {
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
}

/** Estado del módulo de detección de anomalías: mientras no haya suficiente
 * historial (calibrating), el modelo no evalúa nada, para no dar falsos positivos. */
export interface AnomalyDetectionStatus {
  status: 'calibrating' | 'active';
  samplesCollected: number;
  samplesRequired: number;
}
