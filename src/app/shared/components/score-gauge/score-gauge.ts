import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SECURITY_SCORE_WEIGHTS, getSecurityScoreBand } from '../../../core/domain/security-score.calculator';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MetricValue } from '../metric-value/metric-value';

const MAX_SCORE = 100;
const SWEEP_DEGREES = 180;
const TICK_STEP = 10;

/**
 * Puntaje de seguridad como dial de signos vitales. Si conozco las dos partes, el arco se divide
 * en cuestionario (30 %) y técnico (70 %), cada tramo lleno según su propio puntaje.
 */
@Component({
  selector: 'app-score-gauge',
  imports: [TranslatePipe, MetricValue],
  templateUrl: './score-gauge.html',
  styleUrl: './score-gauge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreGauge {
  readonly score = input.required<number>();
  readonly questionnaireScore = input<number | null>(null);
  readonly technicalScore = input<number | null>(null);

  protected readonly weights = SECURITY_SCORE_WEIGHTS;
  protected readonly ticks = Array.from({ length: MAX_SCORE / TICK_STEP + 1 }, (_, i) => i * TICK_STEP);
  protected readonly band = computed(() => getSecurityScoreBand(this.score()));
  protected readonly needleAngle = computed(() => `${(this.clamp(this.score()) / MAX_SCORE) * SWEEP_DEGREES}deg`);

  /** Rellenos de cada tramo en unidades del arco (pathLength 100); null si es un medidor simple. */
  protected readonly parts = computed(() => {
    const questionnaire = this.questionnaireScore();
    const technical = this.technicalScore();
    if (questionnaire === null || technical === null) {
      return null;
    }
    return {
      questionnaire,
      technical,
      questionnaireFill: (this.clamp(questionnaire) / MAX_SCORE) * SECURITY_SCORE_WEIGHTS.questionnaire,
      technicalFill: (this.clamp(technical) / MAX_SCORE) * SECURITY_SCORE_WEIGHTS.technical,
    };
  });

  protected tickAngle(tick: number): string {
    return `${(tick / MAX_SCORE) * SWEEP_DEGREES}deg`;
  }

  private clamp(value: number): number {
    return Math.min(Math.max(value, 0), MAX_SCORE);
  }
}
