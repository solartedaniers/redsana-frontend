export interface AiStatusPollConfig {
  /** Red de seguridad por si el backend nunca contesta: quien decide "no disponible" es el calentamiento del backend
   * (AI_SERVICE_WARM_UP_TIMEOUT_SECONDS, 300 s), así que debe superarlo más el arranque en frío del propio backend
   * (~70 s medidos en Render). */
  readonly maxWaitMs: number;
  readonly initialPollDelayMs: number;
  readonly backoffFactor: number;
  readonly maxPollDelayMs: number;
}

export const AI_STATUS_CONFIG: AiStatusPollConfig = {
  maxWaitMs: 420_000,
  initialPollDelayMs: 2_000,
  backoffFactor: 1.5,
  maxPollDelayMs: 10_000,
};

/** Esperas entre consultas: crecen hasta maxPollDelayMs y su suma cubre maxWaitMs. Su largo es el tope de intentos;
 * el de tiempo lo corta AiStatusService con un reloj aparte. */
export function buildPollDelays(config: AiStatusPollConfig): number[] {
  const delays: number[] = [];
  let waitedMs = 0;
  while (waitedMs < config.maxWaitMs) {
    const delay = Math.min(config.initialPollDelayMs * config.backoffFactor ** delays.length, config.maxPollDelayMs);
    delays.push(delay);
    waitedMs += delay;
  }
  return delays;
}
