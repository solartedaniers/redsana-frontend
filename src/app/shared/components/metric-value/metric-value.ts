import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface OdometerChar {
  readonly char: string;
  readonly digit: number | null;
}

const DIGIT_PATTERN = /\d/;

/**
 * Giant tabular reading that rolls each digit like an odometer when the value
 * changes. The real characters stay in the DOM (accessible, copyable); the
 * rolling digit strip is decorative and animates `transform` only.
 */
@Component({
  selector: 'app-metric-value',
  template: `@for (cell of chars(); track $index) {@if (cell.digit !== null) {<span class="odometer-cell" [style.--odometer-digit]="cell.digit"><span class="odometer-char">{{ cell.char }}</span></span>} @else {<span>{{ cell.char }}</span>}}`,
  styleUrl: './metric-value.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricValue {
  readonly value = input.required<string>();

  protected readonly chars = computed<OdometerChar[]>(() =>
    [...this.value()].map((char) => ({ char, digit: DIGIT_PATTERN.test(char) ? Number(char) : null }))
  );
}
