export interface AiStatusPollConfig {
  /** Espera total antes de dar la IA por no disponible; el arranque en frío de Render incluye importar scikit-learn. */
  readonly maxWaitMs: number;
  readonly initialPollDelayMs: number;
  readonly backoffFactor: number;
  readonly maxPollDelayMs: number;
}

export const AI_STATUS_CONFIG: AiStatusPollConfig = {
  maxWaitMs: 150_000,
  initialPollDelayMs: 2_000,
  backoffFactor: 1.5,
  maxPollDelayMs: 10_000,
};

/** Esperas entre consultas: crecen hasta maxPollDelayMs y su suma cubre maxWaitMs. Su largo es el tope de intentos. */
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
