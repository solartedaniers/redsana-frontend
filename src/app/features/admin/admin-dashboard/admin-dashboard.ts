import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdminMetricsRepository } from '../../../core/repositories/admin-metrics.repository';
import { PlatformMetrics } from '../../../core/models/admin.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { MetricCard } from '../../../shared/components/metric-card/metric-card';

@Component({
  selector: 'app-admin-dashboard',
  imports: [PageHeader, MetricCard],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private readonly repository = inject(AdminMetricsRepository);

  protected readonly metrics = signal<PlatformMetrics | null>(null);

  constructor() {
    this.repository.getPlatformMetrics().subscribe((metrics) => this.metrics.set(metrics));
  }
}
