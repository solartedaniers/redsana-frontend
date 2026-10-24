import { MeasurementSource, NetworkQualityMeasurement } from '../models/network.model';

/** Una medición esperando a enviarse, con la hora en que se tomó: esa hora es también su clave contra duplicados. */
export interface PendingMeasurement {
  /** De quién es: con otra sesión abierta en el equipo no se envía a nombre de otro. */
  ownerId: string;
  recordedAt: string;
  measurement: NetworkQualityMeasurement;
  source: MeasurementSource;
  networkFingerprint: string | null;
}

export const PENDING_MEASUREMENTS_CONFIG = {
  /** Tope de la cola: un día midiendo cada minuto. Llena, se descarta lo más viejo. */
  maxItems: 1440,
  /** Lo más viejo que se guarda; igual a MEASUREMENT_MAX_AGE_HOURS del backend, que rechaza lo anterior. */
  maxAgeMs: 24 * 60 * 60 * 1000,
  /** Cuántas se envían por ciclo y la pausa entre una y otra: al volver la red no sale una avalancha. */
  flushBatchSize: 30,
  flushPauseMs: 200,
} as const;
