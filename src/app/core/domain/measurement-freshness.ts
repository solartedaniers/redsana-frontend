import { NetworkMetricSnapshot } from '../models/network.model';

export const MEASUREMENT_CONFIG = {
  /** Cada cuánto se mide la red en segundo plano. */
  intervalMs: 60_000,
  // Doy por "en vivo" una medición de hasta 3 ciclos: así un ciclo perdido no apaga la etiqueta.
  liveMaxAgeIntervals: 3,
} as const;

/** false cuando el backend aún no tiene ninguna medición: responde status "unknown" con ceros de relleno. */
export function hasMeasurement(snapshot: NetworkMetricSnapshot | null): snapshot is NetworkMetricSnapshot {
  return snapshot !== null && snapshot.status !== 'unknown';
}

/** true solo si hay medición real y es reciente; nunca etiqueto como "en vivo" un dato viejo. */
export function isLiveMeasurement(snapshot: NetworkMetricSnapshot | null, nowMs: number): boolean {
  if (!hasMeasurement(snapshot)) {
    return false;
  }
  const ageMs = nowMs - Date.parse(snapshot.updatedAt);
  return ageMs <= MEASUREMENT_CONFIG.intervalMs * MEASUREMENT_CONFIG.liveMaxAgeIntervals;
}
