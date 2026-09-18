import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { NetworkSupervisionRepository } from '../../../core/repositories/network-supervision.repository';
import { NetworkMetricSample, NetworkMetricSnapshot } from '../../../core/models/network.model';
import { MonitoredHousehold } from '../../../core/models/admin.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { NetworkStatusLight } from '../../../shared/components/network-status-light/network-status-light';
import { MetricCard } from '../../../shared/components/metric-card/metric-card';
import { HistoryChart } from '../../../shared/components/history-chart/history-chart';
import { ScoreGauge } from '../../../shared/components/score-gauge/score-gauge';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

// El backend no expone un endpoint "por id" para hogares: se reutiliza
// getHouseholds() y se filtra en cliente.
@Component({
  selector: 'app-household-detail',
  imports: [RouterLink, PageHeader, NetworkStatusLight, MetricCard, HistoryChart, ScoreGauge, TranslatePipe],
  templateUrl: './household-detail.html',
  styleUrl: './household-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HouseholdDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly metricsRepository = inject(NetworkMetricsRepository);
  private readonly supervisionRepository = inject(NetworkSupervisionRepository);

  protected readonly household = signal<MonitoredHousehold | null>(null);
  protected readonly snapshot = signal<NetworkMetricSnapshot | null>(null);
  protected readonly history = signal<NetworkMetricSample[]>([]);

  constructor() {
    const householdId = this.route.snapshot.paramMap.get('id') ?? '';

    this.supervisionRepository.getHouseholds().subscribe((households) => {
      this.household.set(households.find((item) => item.id === householdId) ?? null);
    });
    this.metricsRepository.getSnapshot(householdId).subscribe((snapshot) => this.snapshot.set(snapshot));
    this.metricsRepository.getHistory(householdId).subscribe((history) => this.history.set(history));
  }
}
