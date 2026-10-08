import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { AnomalyDetectionStatus, NetworkMetricSample, NetworkMetricSnapshot, NetworkStatus } from '../../../core/models/network.model';
import { LatencySeverity } from '../../../core/domain/latency-severity';
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
  imports: [PageHeader, NetworkStatusLight, NetworkStatusBadge, MetricCard, HistoryChart, TranslatePipe, DatePipe, RouterLink],
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
  /** Severity tint of the ambient aura; none until there is a real measurement. */
  protected readonly aura = computed(() => STATUS_AURA[this.snapshot()?.status ?? 'unknown']);

  constructor() {
    // watchSnapshot ya emite un valor inicial y se re-suscribe sola cada
    // pocos segundos; no hace falta gestionar un intervalo aquí.
    // takeUntilDestroyed: sin esto cada visita al panel dejaba otro sondeo de 4 s vivo para siempre.
    this.metricsRepository
      .watchSnapshot()
      .pipe(takeUntilDestroyed())
      .subscribe((snapshot) => this.snapshot.set(snapshot));
    this.metricsRepository.getHistory().subscribe((history) => this.history.set(history));
    // Se consulta una sola vez al cargar: el conteo solo importa mientras
    // calibra, no hace falta refrescarlo en vivo como el snapshot de red.
    this.metricsRepository.getAnomalyStatus().subscribe((status) => this.anomalyStatus.set(status));
  }
}
