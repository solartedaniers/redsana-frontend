import { classifyMeasurement } from '../../../core/domain/latency-severity';
import { FALLBACK_NETWORK_STATUS_THRESHOLDS as DEFAULTS } from '../../../core/network-thresholds/network-thresholds.config';
import { HISTORY_CHART_CONFIG } from './history-chart.config';
import { LatencyTraceBuilder } from './latency-trace.builder';

const sample = (latencyMs: number, minute: number, packetLossPercent?: number) => ({
  latencyMs,
  packetLossPercent,
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
});

// Los mismos casos que tests/test_network_status.py del backend, traducidos a su severidad en el gráfico
// (good → healthy). Si uno cambia sin el otro, el dashboard y el gráfico dejarían de coincidir.
const BACKEND_CASES: Array<[number, number, string]> = [
  [79.9, 0, 'healthy'],
  [80, 0, 'warning'],
  [149.9, 0, 'warning'],
  [150, 0, 'critical'],
  [20, 0.99, 'healthy'],
  [20, 1, 'warning'],
  [20, 4.99, 'warning'],
  [20, 5, 'critical'],
  [50, 3, 'warning'],
];

describe('LatencyTraceBuilder', () => {
  const builder = new LatencyTraceBuilder();

  it('clasifica latencia y pérdida con los mismos umbrales y bordes que el backend', () => {
    expect(BACKEND_CASES.map(([latency, loss]) => classifyMeasurement(latency, loss, DEFAULTS))).toEqual(
      BACKEND_CASES.map(([, , expected]) => expected),
    );
  });

  it('0 ms es un corte; sin dato de pérdida (backend anterior) clasifica solo por latencia', () => {
    expect(classifyMeasurement(0, 100, DEFAULTS)).toBe('cut');
    expect(classifyMeasurement(50, undefined, DEFAULTS)).toBe('healthy');
  });

  it('50 ms con 3 % de pérdida queda en advertencia en el trazo y en el mapa de calor, como en el dashboard', () => {
    const trace = builder.build([sample(20, 0, 0), sample(50, 1, 3), sample(25, 2, 0)], DEFAULTS);

    expect(trace.points[1].severity).toBe('warning');
    expect(trace.heatmap.map((cell) => cell.severity)).toContain('warning');
  });

  it('usa los umbrales que recibe: con otros valores del backend cambian la clasificación y las líneas', () => {
    const custom = {
      latencyWarningMs: 40,
      latencyCriticalMs: 60,
      packetLossWarningPercent: 10,
      packetLossCriticalPercent: 20,
    };
    const withDefaults = builder.build([sample(50, 0, 3)], DEFAULTS);
    const withCustom = builder.build([sample(50, 0, 3)], custom);

    expect(withDefaults.points[0].severity).toBe('warning');
    expect(withCustom.points[0].severity).toBe('warning');
    expect(builder.build([sample(65, 0, 0)], custom).points[0].severity).toBe('critical');
    expect(withCustom.criticalY).not.toBeNull();
    expect(withDefaults.criticalY).toBeNull();
  });

  it('al reducir historiales largos conserva la medición con pérdida aunque su latencia sea menor', () => {
    const long = Array.from({ length: 1000 }, (_, i) => sample(i === 500 ? 60 : 70, i, i === 500 ? 6 : 0));
    const trace = builder.build(long, DEFAULTS);

    expect(trace.points.some((point) => point.severity === 'critical' && point.latencyMs === 60)).toBe(true);
  });

  it('marca solo los picos que cruzan un umbral y los cortes', () => {
    const trace = builder.build([sample(20, 0), sample(95, 1), sample(30, 2), sample(0, 3), sample(25, 4)], DEFAULTS);

    expect(trace.markers.map((point) => point.latencyMs)).toEqual([95, 0]);
    expect(trace.stats).toEqual({ min: 20, avg: 42.5, max: 95, count: 4 });
    expect(trace.warningY).not.toBeNull();
    expect(trace.criticalY).toBeNull();
  });

  it('con una red degradada todo el tiempo solo marca los picos más altos', () => {
    const zigzag = Array.from({ length: 40 }, (_, i) => sample(i % 2 === 0 ? 200 + i : 160, i));
    const trace = builder.build(zigzag, DEFAULTS);

    expect(trace.markers.length).toBe(HISTORY_CHART_CONFIG.maxPeakMarkers);
    expect(trace.markers.map((point) => point.latencyMs)).toContain(238);
  });

  it('reduce historiales largos sin perder el pico ni el corte', () => {
    const long = Array.from({ length: 1000 }, (_, i) => sample(i === 500 ? 400 : i === 900 ? 0 : 20, i));
    const trace = builder.build(long, DEFAULTS);

    expect(trace.points.length).toBeLessThanOrEqual(HISTORY_CHART_CONFIG.maxTracePoints);
    expect(trace.points.some((point) => point.latencyMs === 400)).toBe(true);
    expect(trace.points.some((point) => point.severity === 'cut')).toBe(true);
    expect(trace.heatmap.length).toBeLessThanOrEqual(HISTORY_CHART_CONFIG.heatmapCells);
  });

  it('sin muestras no dibuja nada ni inventa estadísticas', () => {
    const trace = builder.build([], DEFAULTS);
    expect(trace.path).toBe('');
    expect(trace.stats).toBeNull();
  });
});
