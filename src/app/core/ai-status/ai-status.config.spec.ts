import { AI_STATUS_CONFIG, buildPollDelays } from './ai-status.config';

describe('buildPollDelays', () => {
  it('crece con backoff y se queda en el máximo', () => {
    const delays = buildPollDelays({ maxWaitMs: 20_000, initialPollDelayMs: 2_000, backoffFactor: 2, maxPollDelayMs: 5_000 });

    expect(delays).toEqual([2_000, 4_000, 5_000, 5_000, 5_000]);
  });

  it('la suma cubre la espera total sin pasarse en más de una consulta', () => {
    const delays = buildPollDelays(AI_STATUS_CONFIG);
    const total = delays.reduce((sum, delay) => sum + delay, 0);

    expect(total).toBeGreaterThanOrEqual(AI_STATUS_CONFIG.maxWaitMs);
    expect(total - delays.at(-1)!).toBeLessThan(AI_STATUS_CONFIG.maxWaitMs);
  });

  it('el tope por defecto es amplio para un arranque en frío y tiene un número finito de intentos', () => {
    expect(AI_STATUS_CONFIG.maxWaitMs).toBe(150_000);
    expect(buildPollDelays(AI_STATUS_CONFIG).length).toBeLessThanOrEqual(20);
  });
});
