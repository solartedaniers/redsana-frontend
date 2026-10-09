import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RecommendationUrgency, getRecommendationUrgency } from '../../../../core/domain/security-score.calculator';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SecurityRecommendation } from '../../../../core/models/security.model';

/** La guía priorizada como receta: dosis numeradas, cada una con la urgencia de su prioridad real. */
@Component({
  selector: 'app-prescription-list',
  imports: [TranslatePipe],
  templateUrl: './prescription-list.html',
  styleUrl: './prescription-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionList {
  readonly recommendations = input.required<SecurityRecommendation[]>();

  protected urgencyOf(priority: number): RecommendationUrgency {
    return getRecommendationUrgency(priority);
  }
}
