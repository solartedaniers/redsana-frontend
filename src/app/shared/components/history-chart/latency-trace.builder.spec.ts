import { classifyLatency } from '../../../core/domain/latency-severity';
import { HISTORY_CHART_CONFIG } from './history-chart.config';
import { LatencyTraceBuilder } from './latency-trace.builder';

const sample = (latencyMs: number, minute: number) => ({
  latencyMs,
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
});

describe('LatencyTraceBuilder', () => {
  const builder = new LatencyTraceBuilder();

  it('clasifica con los mismos umbrales que el backend y trata 0 ms como corte', () => {
    expect([0, 20, 80, 149, 150].map(classifyLatency)).toEqual(['cut', 'healthy', 'warning', 'warning', 'critical']);
  });

  it('marca solo los picos que cruzan un umbral y los cortes', () => {
    const trace = builder.build([sample(20, 0), sample(95, 1), sample(30, 2), sample(0, 3), sample(25, 4)]);

    expect(trace.markers.map((point) => point.latencyMs)).toEqual([95, 0]);
    expect(trace.stats).toEqual({ min: 20, avg: 42.5, max: 95, count: 4 });
    expect(trace.warningY).not.toBeNull();
    expect(trace.criticalY).toBeNull();
  });

  it('con una red degradada todo el tiempo solo marca los picos más altos', () => {
    const zigzag = Array.from({ length: 40 }, (_, i) => sample(i % 2 === 0 ? 200 + i : 160, i));
    const trace = builder.build(zigzag);

    expect(trace.markers.length).toBe(HISTORY_CHART_CONFIG.maxPeakMarkers);
    expect(trace.markers.map((point) => point.latencyMs)).toContain(238);
  });

  it('reduce historiales largos sin perder el pico ni el corte', () => {
    const long = Array.from({ length: 1000 }, (_, i) => sample(i === 500 ? 400 : i === 900 ? 0 : 20, i));
    const trace = builder.build(long);

    expect(trace.points.length).toBeLessThanOrEqual(HISTORY_CHART_CONFIG.maxTracePoints);
    expect(trace.points.some((point) => point.latencyMs === 400)).toBe(true);
    expect(trace.points.some((point) => point.severity === 'cut')).toBe(true);
    expect(trace.heatmap.length).toBeLessThanOrEqual(HISTORY_CHART_CONFIG.heatmapCells);
  });

  it('sin muestras no dibuja nada ni inventa estadísticas', () => {
    const trace = builder.build([]);
    expect(trace.path).toBe('');
    expect(trace.stats).toBeNull();
  });
});
