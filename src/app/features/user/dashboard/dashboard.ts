import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { AnomalyDetectionStatus, NetworkMetricSample, NetworkMetricSnapshot, NetworkStatus } from '../../../core/models/network.model';
import { LatencySeverity } from '../../../core/domain/latency-severity';
import { hasMeasurement, isLiveMeasurement } from '../../../core/domain/measurement-freshness';
import { injectMeasurementClock } from '../../../core/network-measurement/measurement-clock';
import { MeasurementEmptyState } from '../../../shared/components/measurement-empty-state/measurement-empty-state';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { NetworkStatusLight } from '../../../shared/components/network-status-light/network-status-light';
import { NetworkStatusBadge } from '../../../shared/components/network-status-badge/network-status-badge';
import { MetricCard } from '../../../shared/components/metric-card/metric-card';
import { HistoryChart } from '../../../shared/components/history-chart/history-chart';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { APP_PATHS } from '../../../core/routing/app-paths';

const STATUS_AURA: Record<NetworkStatus, LatencySeverity | null> = {
  good: 'healthy',
  warning: 'warning',
  critical: 'critical',
  unknown: null,
};

@Component({
  selector: 'app-dashboard',
  imports: [PageHeader, NetworkStatusLight, NetworkStatusBadge, MetricCard, HistoryChart, MeasurementEmptyState, TranslatePipe, DatePipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-severity]': 'aura()' },
})
export class Dashboard {
  protected readonly paths = APP_PATHS;
  private readonly metricsRepository = inject(NetworkMetricsRepository);

  protected readonly snapshot = signal<NetworkMetricSnapshot | null>(null);
  protected readonly history = signal<NetworkMetricSample[]>([]);
  protected readonly anomalyStatus = signal<AnomalyDetectionStatus | null>(null);
  /** Tinte del aura ambiental; ninguno hasta que haya una medición real. */
  private readonly clock = injectMeasurementClock();
  /** false mientras el backend no tenga ninguna medición real (responde "unknown" con ceros). */
  protected readonly hasData = computed(() => hasMeasurement(this.snapshot()));
  protected readonly isLive = computed(() => isLiveMeasurement(this.snapshot(), Math.max(this.clock(), Date.now())));
  protected readonly aura = computed(() => STATUS_AURA[this.snapshot()?.status ?? 'unknown']);

  constructor() {
    // watchSnapshot ya reconsulta solo; takeUntilDestroyed evita que cada visita deje otro sondeo vivo para siempre.
    this.metricsRepository
      .watchSnapshot()
      .pipe(takeUntilDestroyed())
      .subscribe((snapshot) => this.snapshot.set(snapshot));
    this.metricsRepository.getHistory().subscribe((history) => this.history.set(history));
    // Lo consulto una sola vez: el conteo solo importa mientras calibra.
    this.metricsRepository.getAnomalyStatus().subscribe((status) => this.anomalyStatus.set(status));
  }
}
