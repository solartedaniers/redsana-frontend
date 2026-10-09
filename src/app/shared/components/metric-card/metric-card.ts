import { formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MetricValue } from '../metric-value/metric-value';

// Las mediciones llegan como float crudo (p. ej. 21.679999 ms); con un decimal basta.
const METRIC_DIGITS_INFO = '1.0-1';

@Component({
  selector: 'app-metric-card',
  imports: [TranslatePipe, MetricValue],
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-variant]': 'variant()' },
})
export class MetricCard {
  private readonly locale = inject(LOCALE_ID);

  readonly labelKey = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string>();
  /** 'hero': la lectura principal de la pantalla, impresa como bloque de marca. */
  readonly variant = input<'default' | 'hero'>('default');

  protected readonly displayValue = computed(() => {
    const value = this.value();
    return typeof value === 'number' ? formatNumber(value, this.locale, METRIC_DIGITS_INFO) : value;
  });
}
