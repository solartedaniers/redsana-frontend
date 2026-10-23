import { DatePipe, formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, signal } from '@angular/core';
import { LatencySeverity } from '../../../core/domain/latency-severity';
import { NetworkMetricSample } from '../../../core/models/network.model';
import { NetworkThresholdsService } from '../../../core/network-thresholds/network-thresholds.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { HISTORY_CHART_CONFIG } from './history-chart.config';
import { LatencyTraceBuilder, TracePoint } from './latency-trace.builder';

const LATENCY_DIGITS_INFO = '1.0-1';
const PERCENT = 100;

let nextChartId = 0;

/** Historial de latencia como electrocardiograma, con tooltip accesible por puntero y teclado. */
@Component({
  selector: 'app-history-chart',
  imports: [TranslatePipe, DatePipe],
  templateUrl: './history-chart.html',
  styleUrl: './history-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryChart {
  readonly samples = input.required<NetworkMetricSample[]>();

  private readonly locale = inject(LOCALE_ID);
  private readonly builder = new LatencyTraceBuilder();

  protected readonly viewBox = `0 0 ${HISTORY_CHART_CONFIG.viewBoxWidth} ${HISTORY_CHART_CONFIG.viewBoxHeight}`;
  protected readonly width = HISTORY_CHART_CONFIG.viewBoxWidth;
  protected readonly height = HISTORY_CHART_CONFIG.viewBoxHeight;
  protected readonly thresholds = inject(NetworkThresholdsService).thresholds;
  protected readonly clipId = `ecg-reveal-${nextChartId++}`;

  protected readonly trace = computed(() => this.builder.build(this.samples(), this.thresholds()));
  protected readonly head = computed(() => this.trace().points.at(-1) ?? null);
  protected readonly activeIndex = signal<number | null>(null);
  protected readonly active = computed(() => {
    const index = this.activeIndex();
    return index === null ? null : (this.trace().points[index] ?? null);
  });

  protected readonly legendSeverities: readonly LatencySeverity[] = ['healthy', 'warning', 'critical', 'cut'];
  /** Los números de la ayuda de la leyenda salen de los umbrales reales (backend o respaldo), nunca de los textos. */
  protected readonly hintParams = computed(() => {
    const limits = this.thresholds();
    return {
      warning: limits.latencyWarningMs,
      critical: limits.latencyCriticalMs,
      lossWarning: limits.packetLossWarningPercent,
      lossCritical: limits.packetLossCriticalPercent,
    };
  });

  protected readonly summaryParams = computed(() => {
    const stats = this.trace().stats;
    return stats && {
      count: stats.count,
      min: this.format(stats.min),
      avg: this.format(stats.avg),
      max: this.format(stats.max),
    };
  });

  protected format(latencyMs: number): string {
    return formatNumber(latencyMs, this.locale, LATENCY_DIGITS_INFO);
  }

  protected left(point: TracePoint): string {
    return `${(point.x / this.width) * PERCENT}%`;
  }

  protected top(point: TracePoint): string {
    return `${(point.y / this.height) * PERCENT}%`;
  }

  protected onPointerMove(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    const { left, width } = target.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - left) / width, 0), 1);
    this.activeIndex.set(Math.round(ratio * (this.trace().points.length - 1)));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.trace().points.length - 1;
    const current = this.activeIndex() ?? last;
    const next: Record<string, number> = {
      ArrowLeft: Math.max(current - 1, 0),
      ArrowRight: Math.min(current + 1, last),
      Home: 0,
      End: last,
    };
    if (event.key === 'Escape') {
      this.activeIndex.set(null);
    } else if (event.key in next) {
      event.preventDefault();
      this.activeIndex.set(next[event.key]);
    }
  }
}
