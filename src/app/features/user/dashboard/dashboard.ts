import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { NetworkMetricSample, NetworkMetricSnapshot } from '../../../core/models/network.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { NetworkStatusLight } from '../../../shared/components/network-status-light/network-status-light';
import { MetricCard } from '../../../shared/components/metric-card/metric-card';
import { HistoryChart } from '../../../shared/components/history-chart/history-chart';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [PageHeader, NetworkStatusLight, MetricCard, HistoryChart, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly metricsRepository = inject(NetworkMetricsRepository);

  protected readonly snapshot = signal<NetworkMetricSnapshot | null>(null);
  protected readonly history = signal<NetworkMetricSample[]>([]);

  constructor() {
    // watchSnapshot ya emite un valor inicial y se re-suscribe sola cada
    // pocos segundos; no hace falta gestionar un intervalo aquí.
    this.metricsRepository.watchSnapshot().subscribe((snapshot) => this.snapshot.set(snapshot));
    this.metricsRepository.getHistory().subscribe((history) => this.history.set(history));
  }
}
