import { NetworkMetricSnapshot } from '../models/network.model';
import { MEASUREMENT_CONFIG, hasMeasurement, isLiveMeasurement } from './measurement-freshness';

const NOW = Date.UTC(2026, 9, 8, 12, 0);
const snapshot = (status: NetworkMetricSnapshot['status'], ageMs: number): NetworkMetricSnapshot => ({
  status,
  latencyMs: 0,
  jitterMs: 0,
  packetLossPercent: 0,
  updatedAt: new Date(NOW - ageMs).toISOString(),
});

describe('measurement freshness', () => {
  const liveWindow = MEASUREMENT_CONFIG.intervalMs * MEASUREMENT_CONFIG.liveMaxAgeIntervals;

  it('sin mediciones (status unknown con ceros de relleno) no hay dato ni "en vivo"', () => {
    expect(hasMeasurement(snapshot('unknown', 0))).toBe(false);
    expect(hasMeasurement(null)).toBe(false);
    expect(isLiveMeasurement(snapshot('unknown', 0), NOW)).toBe(false);
  });

  it('una medición real es "en vivo" solo dentro del umbral configurado', () => {
    expect(isLiveMeasurement(snapshot('good', liveWindow), NOW)).toBe(true);
    expect(isLiveMeasurement(snapshot('good', liveWindow + 1), NOW)).toBe(false);
  });
});
