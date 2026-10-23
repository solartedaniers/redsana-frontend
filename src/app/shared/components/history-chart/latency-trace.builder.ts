import { NetworkMetricSample } from '../../../core/models/network.model';
import { LatencySeverity, classifyMeasurement, severityRank, worstSeverity } from '../../../core/domain/latency-severity';
import { NetworkStatusThresholds } from '../../../core/network-thresholds/network-thresholds.config';
import { HISTORY_CHART_CONFIG } from './history-chart.config';

export interface TracePoint {
  readonly x: number;
  readonly y: number;
  readonly latencyMs: number;
  readonly packetLossPercent: number | undefined;
  readonly timestamp: string;
  readonly severity: LatencySeverity;
}

export interface HeatmapCell {
  readonly x: number;
  readonly width: number;
  readonly severity: LatencySeverity;
}

export interface LatencyStats {
  readonly min: number;
  readonly avg: number;
  readonly max: number;
  readonly count: number;
}

export interface LatencyTrace {
  readonly points: readonly TracePoint[];
  readonly path: string;
  /** Y de cada línea de umbral; null si el umbral queda por encima del rango visible. */
  readonly warningY: number | null;
  readonly criticalY: number | null;
  /** Picos que cruzaron un umbral y cortes: los dos llevan marcador. */
  readonly markers: readonly TracePoint[];
  readonly heatmap: readonly HeatmapCell[];
  /** Solo sobre las muestras con respuesta (los cortes no tienen latencia); null si no hay ninguna. */
  readonly stats: LatencyStats | null;
}

const { viewBoxWidth: WIDTH, viewBoxHeight: HEIGHT } = HISTORY_CHART_CONFIG;

type Classifier = (sample: NetworkMetricSample) => LatencySeverity;

/** Convierte las muestras reales en la geometría del ECG; es puro, el componente solo pinta lo que recibe. */
export class LatencyTraceBuilder {
  build(samples: readonly NetworkMetricSample[], thresholds: NetworkStatusThresholds): LatencyTrace {
    const classify = (sample: NetworkMetricSample) => classifyMeasurement(sample.latencyMs, sample.packetLossPercent, thresholds);
    const reduced = this.reduce(samples, HISTORY_CHART_CONFIG.maxTracePoints, classify);
    const answered = samples.map((sample) => sample.latencyMs).filter((latency) => latency > 0);
    const peak = answered.reduce((max, latency) => Math.max(max, latency), 0);
    // La escala siempre llega al umbral de alerta: así una red tranquila se ve tranquila y no como un zigzag alarmante.
    const yMax = Math.max(peak * HISTORY_CHART_CONFIG.headroom, thresholds.latencyWarningMs);
    const toY = (latencyMs: number): number => HEIGHT - (Math.max(latencyMs, 0) / yMax) * HEIGHT;
    const step = WIDTH / Math.max(reduced.length - 1, 1);

    const points = reduced.map<TracePoint>((sample, index) => ({
      x: reduced.length === 1 ? WIDTH : index * step,
      y: toY(sample.latencyMs),
      latencyMs: sample.latencyMs,
      packetLossPercent: sample.packetLossPercent,
      timestamp: sample.timestamp,
      severity: classify(sample),
    }));

    return {
      points,
      path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join(''),
      warningY: this.thresholdY(thresholds.latencyWarningMs, yMax, toY),
      criticalY: this.thresholdY(thresholds.latencyCriticalMs, yMax, toY),
      markers: this.markers(points),
      heatmap: this.heatmap(samples, classify),
      stats: answered.length === 0 ? null : {
        min: answered.reduce((min, latency) => Math.min(min, latency), Infinity),
        avg: answered.reduce((sum, latency) => sum + latency, 0) / answered.length,
        max: peak,
        count: answered.length,
      },
    };
  }

  private thresholdY(threshold: number, yMax: number, toY: (latency: number) => number): number | null {
    return threshold > yMax ? null : toY(threshold);
  }

  // Todos los cortes, más los picos más altos que cruzaron un umbral.
  private markers(points: readonly TracePoint[]): TracePoint[] {
    const peaks = points
      .filter((point, index) => this.isThresholdPeak(points, index))
      .sort((a, b) => b.latencyMs - a.latencyMs)
      .slice(0, HISTORY_CHART_CONFIG.maxPeakMarkers);
    return points.filter((point) => point.severity === 'cut' || peaks.includes(point));
  }

  private isThresholdPeak(points: readonly TracePoint[], index: number): boolean {
    const point = points[index];
    if (point.severity === 'cut' || point.severity === 'healthy') {
      return false;
    }
    const previous = points[index - 1]?.latencyMs ?? -Infinity;
    const next = points[index + 1]?.latencyMs ?? -Infinity;
    return point.latencyMs >= previous && point.latencyMs > next;
  }

  // Cada grupo se representa con su peor muestra (primero un corte, luego la peor severidad y, a igual severidad, la
  // latencia más alta) para no perder picos ni mediciones con pérdida.
  private reduce(samples: readonly NetworkMetricSample[], limit: number, classify: Classifier): NetworkMetricSample[] {
    if (samples.length <= limit) {
      return [...samples];
    }
    return this.buckets(samples, limit).map((bucket) =>
      bucket.reduce((worst, sample) => (this.outranks(sample, worst, classify) ? sample : worst))
    );
  }

  private outranks(candidate: NetworkMetricSample, current: NetworkMetricSample, classify: Classifier): boolean {
    const rankDifference = severityRank(classify(candidate)) - severityRank(classify(current));
    return rankDifference !== 0 ? rankDifference > 0 : candidate.latencyMs > current.latencyMs;
  }

  private heatmap(samples: readonly NetworkMetricSample[], classify: Classifier): HeatmapCell[] {
    const buckets = this.buckets(samples, HISTORY_CHART_CONFIG.heatmapCells);
    const width = WIDTH / Math.max(buckets.length, 1);
    return buckets.map((bucket, index) => ({
      x: index * width,
      width,
      severity: bucket.map(classify).reduce(worstSeverity),
    }));
  }

  private buckets(samples: readonly NetworkMetricSample[], count: number): NetworkMetricSample[][] {
    const size = Math.ceil(samples.length / count);
    const buckets: NetworkMetricSample[][] = [];
    for (let start = 0; start < samples.length; start += size) {
      buckets.push(samples.slice(start, start + size));
    }
    return buckets;
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
