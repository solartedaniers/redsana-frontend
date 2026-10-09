import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertsRepository } from '../../../core/repositories/alerts.repository';
import { NetworkAlert } from '../../../core/models/alert.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { AlertItem } from '../../../shared/components/alert-item/alert-item';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { listStaggerAnimation } from '../../../core/animations/list-stagger.animation';
import { AlertsSummary } from './alerts-summary/alerts-summary';

type AlertsLoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-alerts-center',
  imports: [PageHeader, AlertItem, AlertsSummary, TranslatePipe],
  templateUrl: './alerts-center.html',
  styleUrl: './alerts-center.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [listStaggerAnimation],
})
export class AlertsCenter {
  private readonly repository = inject(AlertsRepository);

  protected readonly alerts = signal<NetworkAlert[]>([]);
  /** Nunca afirmo "no hay alertas" si la consulta falló: el vacío solo vale con 'ready'. */
  protected readonly loadState = signal<AlertsLoadState>('loading');

  constructor() {
    this.loadAlerts();
    // Antepongo cada alerta nueva para que se vea su entrada; el sondeo vive solo mientras la pantalla está abierta.
    this.repository
      .watchNewAlerts()
      .pipe(takeUntilDestroyed())
      .subscribe((alert) => this.alerts.update((current) => [alert, ...current]));
  }

  protected loadAlerts(): void {
    this.loadState.set('loading');
    this.repository.getAlerts().subscribe({
      next: (alerts) => {
        // Conservo las que el sondeo ya trajo mientras tanto, sin duplicarlas.
        const loadedIds = new Set(alerts.map((alert) => alert.id));
        this.alerts.update((current) => [...current.filter((alert) => !loadedIds.has(alert.id)), ...alerts]);
        this.loadState.set('ready');
      },
      error: () => this.loadState.set('error'),
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
