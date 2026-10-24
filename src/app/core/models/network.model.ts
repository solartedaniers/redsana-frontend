export type NetworkStatus = 'good' | 'warning' | 'critical' | 'unknown';

export interface NetworkMetricSnapshot {
  status: NetworkStatus;
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  updatedAt: string;
  /** Quién la midió; falta si el backend es anterior a este campo o aún no hay mediciones. */
  source?: MeasurementSource;
  /** Latencia al router (solo escritorio); null o ausente sin ese dato. */
  gatewayLatencyMs?: number | null;
  /** Diagnóstico del backend; null sin dato del router (la web, el 0.1.5 o un router que no responde). */
  diagnosis?: NetworkDiagnosis | null;
  /** Solo una posibilidad, nunca un hecho: router lento y muchos dispositivos conectados. */
  possibleBusyDevice?: boolean | null;
}

/** Debe coincidir con NetworkDiagnosis del backend. */
export type NetworkDiagnosis = 'router' | 'provider' | 'ok';

export interface NetworkMetricSample {
  timestamp: string;
  latencyMs: number;
  /** Falta si el backend es anterior a este campo: entonces el gráfico clasifica solo por latencia. */
  packetLossPercent?: number;
}

/** Debe coincidir con MeasurementSource del backend: la latencia HTTP y el ping ICMP no se mezclan. */
export type MeasurementSource = 'native' | 'web';

/** Medición real que entrega el comando Tauri measure_network_quality. */
export interface NetworkQualityMeasurement {
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  /** Latencia al router; null sin router o si no respondió. Solo la mide el escritorio. */
  gatewayLatencyMs?: number | null;
}

/** Mientras calibra el modelo no evalúa nada, para no dar falsos positivos. */
export interface AnomalyDetectionStatus {
  /** unknown_network: la última medición no tiene red identificada y no cuenta para ninguna. */
  status: 'calibrating' | 'active' | 'unknown_network';
  samplesCollected: number;
  samplesRequired: number;
}
