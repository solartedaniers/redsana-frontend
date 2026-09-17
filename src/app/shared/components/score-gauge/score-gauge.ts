import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getSecurityScoreBand } from '../../../core/domain/security-score.calculator';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'app-score-gauge',
  imports: [],
  templateUrl: './score-gauge.html',
  styleUrl: './score-gauge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreGauge {
  readonly score = input.required<number>();

  protected readonly circumference = CIRCUMFERENCE;
  protected readonly band = computed(() => getSecurityScoreBand(this.score()));
  protected readonly dashOffset = computed(
    () => CIRCUMFERENCE - (this.score() / 100) * CIRCUMFERENCE
  );
}
