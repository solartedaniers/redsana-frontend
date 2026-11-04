export interface LiveUpdatesConfig {
  /** Sondeo de /latest mientras el socket no está en vivo. */
  readonly snapshotPollIntervalMs: number;
  /** Sondeo de /api/alerts/recent mientras el socket no está en vivo. */
  readonly newAlertsPollIntervalMs: number;
  /** Primera espera antes de reconectar; crece con backoffFactor hasta maxReconnectDelayMs. */
  readonly initialReconnectDelayMs: number;
  readonly reconnectBackoffFactor: number;
  readonly maxReconnectDelayMs: number;
  /** Solo un socket que estuvo en vivo al menos este tiempo vuelve a la espera inicial: uno que se cae enseguida de
   * conectar sigue esperando más cada vez, así no hay bucles rápidos de reconexión. */
  readonly stableConnectionMs: number;
}

export const LIVE_UPDATES_CONFIG: LiveUpdatesConfig = {
  snapshotPollIntervalMs: 4_000,
  newAlertsPollIntervalMs: 10_000,
  initialReconnectDelayMs: 2_000,
  reconnectBackoffFactor: 2,
  maxReconnectDelayMs: 60_000,
  stableConnectionMs: 30_000,
};

/** Espera antes del intento número attempt (desde 0): crece hasta el tope y se reparte al azar entre la mitad y el
 * total, para que muchas pestañas que se cayeron a la vez no vuelvan todas juntas. */
export function reconnectDelayMs(
  attempt: number,
  config: LiveUpdatesConfig,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(
    config.initialReconnectDelayMs * config.reconnectBackoffFactor ** attempt,
    config.maxReconnectDelayMs,
  );
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}
