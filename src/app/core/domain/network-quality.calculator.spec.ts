import { aggregateLatencySamples } from './network-quality.calculator';

describe('aggregateLatencySamples', () => {
  it('promedia la latencia de las muestras recibidas', () => {
    expect(aggregateLatencySamples([10, 20, 30], 3).latencyMs).toBe(20);
  });

  it('calcula el jitter como el promedio de la diferencia entre muestras consecutivas', () => {
    expect(aggregateLatencySamples([10, 20, 15], 3).jitterMs).toBe(7.5);
  });

  it('calcula la pérdida a partir de las muestras faltantes', () => {
    expect(aggregateLatencySamples([10, 20], 4).packetLossPercent).toBe(50);
  });

  it('pérdida total no divide por cero', () => {
    expect(aggregateLatencySamples([], 5)).toEqual({ latencyMs: 0, jitterMs: 0, packetLossPercent: 100 });
  });

  it('una sola muestra no tiene jitter', () => {
    expect(aggregateLatencySamples([42], 1)).toEqual({ latencyMs: 42, jitterMs: 0, packetLossPercent: 0 });
  });
});
