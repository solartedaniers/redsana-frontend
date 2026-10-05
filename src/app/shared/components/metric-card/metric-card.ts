import { formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

// Las mediciones llegan como float crudo (p. ej. 21.679999 ms desde Rust o
// fetch); un decimal basta para leerlas y los enteros se muestran igual.
const METRIC_DIGITS_INFO = '1.0-1';

@Component({
  selector: 'app-metric-card',
  imports: [TranslatePipe],
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricCard {
  private readonly locale = inject(LOCALE_ID);

  readonly labelKey = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string>();

  protected readonly displayValue = computed(() => {
    const value = this.value();
    return typeof value === 'number' ? formatNumber(value, this.locale, METRIC_DIGITS_INFO) : value;
  });
}
