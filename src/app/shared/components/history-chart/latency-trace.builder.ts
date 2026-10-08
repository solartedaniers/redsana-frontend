import { NetworkMetricSample } from '../../../core/models/network.model';
import { LATENCY_THRESHOLDS_MS, LatencySeverity, classifyLatency, worstSeverity } from '../../../core/domain/latency-severity';
import { HISTORY_CHART_CONFIG } from './history-chart.config';

export interface TracePoint {
  readonly x: number;
  readonly y: number;
  readonly latencyMs: number;
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
  /** Y of each threshold line; null when the threshold is above the visible range. */
  readonly warningY: number | null;
  readonly criticalY: number | null;
  /** Local maxima that crossed a threshold, and outages: both get a marker. */
  readonly markers: readonly TracePoint[];
  readonly heatmap: readonly HeatmapCell[];
  /** Over answered samples only (outages have no latency); null if none. */
  readonly stats: LatencyStats | null;
}

const { viewBoxWidth: WIDTH, viewBoxHeight: HEIGHT } = HISTORY_CHART_CONFIG;

/**
 * Turns real latency samples into the geometry of the ECG chart: the trace,
 * severity thresholds, peak/outage markers and a heatmap strip. Pure and
 * framework-free, so the chart component only renders what it gets.
 */
export class LatencyTraceBuilder {
  build(samples: readonly NetworkMetricSample[]): LatencyTrace {
    const reduced = this.reduce(samples, HISTORY_CHART_CONFIG.maxTracePoints);
    const answered = samples.map((sample) => sample.latencyMs).filter((latency) => latency > 0);
    const peak = answered.reduce((max, latency) => Math.max(max, latency), 0);
    // The scale always reaches the warning line, so a calm network reads as a
    // low trace under it instead of a stretched, alarming zigzag.
    const yMax = Math.max(peak * HISTORY_CHART_CONFIG.headroom, LATENCY_THRESHOLDS_MS.warning);
    const toY = (latencyMs: number): number => HEIGHT - (Math.max(latencyMs, 0) / yMax) * HEIGHT;
    const step = WIDTH / Math.max(reduced.length - 1, 1);

    const points = reduced.map<TracePoint>((sample, index) => ({
      x: reduced.length === 1 ? WIDTH : index * step,
      y: toY(sample.latencyMs),
      latencyMs: sample.latencyMs,
      timestamp: sample.timestamp,
      severity: classifyLatency(sample.latencyMs),
    }));

    return {
      points,
      path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join(''),
      warningY: this.thresholdY(LATENCY_THRESHOLDS_MS.warning, yMax, toY),
      criticalY: this.thresholdY(LATENCY_THRESHOLDS_MS.critical, yMax, toY),
      markers: points.filter((point, index) => this.isMarker(points, index)),
      heatmap: this.heatmap(samples),
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

  private isMarker(points: readonly TracePoint[], index: number): boolean {
    const point = points[index];
    if (point.severity === 'cut') {
      return true;
    }
    if (point.severity === 'healthy') {
      return false;
    }
    const previous = points[index - 1]?.latencyMs ?? -Infinity;
    const next = points[index + 1]?.latencyMs ?? -Infinity;
    return point.latencyMs >= previous && point.latencyMs > next;
  }

  // Keeps at most `limit` samples: each bucket is represented by its worst
  // sample (an outage first, then the highest latency), so peaks never vanish.
  private reduce(samples: readonly NetworkMetricSample[], limit: number): NetworkMetricSample[] {
    if (samples.length <= limit) {
      return [...samples];
    }
    return this.buckets(samples, limit).map((bucket) =>
      bucket.reduce((worst, sample) => (this.outranks(sample, worst) ? sample : worst))
    );
  }

  private outranks(candidate: NetworkMetricSample, current: NetworkMetricSample): boolean {
    if (candidate.latencyMs <= 0 || current.latencyMs <= 0) {
      return candidate.latencyMs <= 0 && current.latencyMs > 0;
    }
    return candidate.latencyMs > current.latencyMs;
  }

  private heatmap(samples: readonly NetworkMetricSample[]): HeatmapCell[] {
    const buckets = this.buckets(samples, HISTORY_CHART_CONFIG.heatmapCells);
    const width = WIDTH / Math.max(buckets.length, 1);
    return buckets.map((bucket, index) => ({
      x: index * width,
      width,
      severity: bucket.map((sample) => classifyLatency(sample.latencyMs)).reduce(worstSeverity),
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
