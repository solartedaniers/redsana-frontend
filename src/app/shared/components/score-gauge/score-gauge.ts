import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { getSecurityScoreBand } from '../../../core/domain/security-score.calculator';
import { SecurityScoreConfigService } from '../../../core/security-score-config/security-score-config.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MetricValue } from '../metric-value/metric-value';

const MAX_SCORE = 100;
const SWEEP_DEGREES = 180;
const TICK_STEP = 10;

// Con las dos partes, el arco se divide según los pesos del cuestionario y del análisis técnico.
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

  private readonly config = inject(SecurityScoreConfigService).config;

  protected readonly weights = computed(() => ({
    questionnaire: this.config().questionnaireWeightPercent,
    technical: this.config().technicalWeightPercent,
  }));
  protected readonly ticks = Array.from({ length: MAX_SCORE / TICK_STEP + 1 }, (_, i) => i * TICK_STEP);
  protected readonly band = computed(() => getSecurityScoreBand(this.score(), this.config()));
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
      questionnaireFill: (this.clamp(questionnaire) / MAX_SCORE) * this.weights().questionnaire,
      technicalFill: (this.clamp(technical) / MAX_SCORE) * this.weights().technical,
    };
  });

  protected tickAngle(tick: number): string {
    return `${(tick / MAX_SCORE) * SWEEP_DEGREES}deg`;
  }

  private clamp(value: number): number {
    return Math.min(Math.max(value, 0), MAX_SCORE);
  }
}
