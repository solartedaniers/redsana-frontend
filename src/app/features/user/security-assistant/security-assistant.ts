import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SecurityAssistantRepository } from '../../../core/repositories/security-assistant.repository';
import {
  SecurityAnswers,
  SecurityAssessmentResult,
  SecurityQuestion,
} from '../../../core/models/security.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ScoreGauge } from '../../../shared/components/score-gauge/score-gauge';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-security-assistant',
  imports: [PageHeader, ScoreGauge, TranslatePipe],
  templateUrl: './security-assistant.html',
  styleUrl: './security-assistant.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityAssistant {
  private readonly repository = inject(SecurityAssistantRepository);

  protected readonly questions = signal<SecurityQuestion[]>([]);
  protected readonly answers = signal<SecurityAnswers>({});
  protected readonly result = signal<SecurityAssessmentResult | null>(null);
  protected readonly isSubmitting = signal(false);

  protected readonly allAnswered = computed(
    () => this.questions().length > 0 && this.questions().every((q) => q.id in this.answers())
  );

  constructor() {
    this.repository.getQuestionnaire().subscribe((questions) => this.questions.set(questions));
  }

  protected answer(questionId: string, value: boolean): void {
    this.answers.update((current) => ({ ...current, [questionId]: value }));
  }

  protected submit(): void {
    this.isSubmitting.set(true);
    this.repository.submitAnswers(this.answers()).subscribe((result) => {
      this.isSubmitting.set(false);
      this.result.set(result);
    });
  }

  protected restart(): void {
    this.answers.set({});
    this.result.set(null);
  }
}
