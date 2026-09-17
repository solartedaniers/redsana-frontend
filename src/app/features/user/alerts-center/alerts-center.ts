import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AlertsRepository } from '../../../core/repositories/alerts.repository';
import { NetworkAlert } from '../../../core/models/alert.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { AlertItem } from '../../../shared/components/alert-item/alert-item';
import { listStaggerAnimation } from '../../../core/animations/list-stagger.animation';

@Component({
  selector: 'app-alerts-center',
  imports: [PageHeader, AlertItem],
  templateUrl: './alerts-center.html',
  styleUrl: './alerts-center.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [listStaggerAnimation],
})
export class AlertsCenter {
  private readonly repository = inject(AlertsRepository);

  protected readonly alerts = signal<NetworkAlert[]>([]);

  constructor() {
    this.repository.getAlerts().subscribe((alerts) => this.alerts.set(alerts));
    // Cada alerta predictiva nueva se antepone a la lista para que el
    // stagger de entrada sea visible sin recargar la pantalla.
    this.repository.watchNewAlerts().subscribe((alert) => {
      this.alerts.update((current) => [alert, ...current]);
    });
  }

  protected onAcknowledge(alertId: string): void {
    this.repository.acknowledge(alertId).subscribe(() => {
      this.alerts.update((current) =>
        current.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert))
      );
    });
  }
}
