import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AlertSeverity, NetworkAlert } from '../../../../core/models/alert.model';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

const SEVERITIES: readonly AlertSeverity[] = ['critical', 'warning', 'info'];
const PERCENT = 100;

/**
 * Real summary of the loaded alerts: how many of each severity, how many are
 * still pending, and a time strip where every alert is a tick placed at its
 * real timestamp between the oldest and the newest one.
 */
@Component({
  selector: 'app-alerts-summary',
  imports: [TranslatePipe],
  templateUrl: './alerts-summary.html',
  styleUrl: './alerts-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsSummary {
  readonly alerts = input.required<NetworkAlert[]>();

  protected readonly counts = computed(() =>
    SEVERITIES.map((severity) => ({ severity, count: this.alerts().filter((alert) => alert.severity === severity).length }))
  );
  protected readonly pending = computed(() => this.alerts().filter((alert) => !alert.acknowledged).length);

  protected readonly ticks = computed(() => {
    const times = this.alerts().map((alert) => Date.parse(alert.timestamp));
    const oldest = Math.min(...times);
    const span = Math.max(...times) - oldest || 1;
    return this.alerts().map((alert, index) => ({
      id: alert.id,
      severity: alert.severity,
      acknowledged: alert.acknowledged,
      left: `${((times[index] - oldest) / span) * PERCENT}%`,
    }));
  });
}
