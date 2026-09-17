import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-metric-card',
  imports: [TranslatePipe],
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricCard {
  readonly labelKey = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string>();
}
