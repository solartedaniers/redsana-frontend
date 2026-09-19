import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SecurityAssistantRepository } from '../../../core/repositories/security-assistant.repository';
import {
  SecurityAnswers,
  SecurityAnswerValue,
  SecurityAssessmentResult,
  SecurityQuestion,
} from '../../../core/models/security.model';
import { WifiEncryptionGateway } from '../../../core/wifi-encryption/wifi-encryption.gateway';
import { evaluateWifiEncryption } from '../../../core/domain/security-score.calculator';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ScoreGauge } from '../../../shared/components/score-gauge/score-gauge';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-security-assistant',
  imports: [PageHeader, ScoreGauge, TranslatePipe, DatePipe, FormsModule],
  templateUrl: './security-assistant.html',
  styleUrl: './security-assistant.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityAssistant {
  private readonly repository = inject(SecurityAssistantRepository);
  private readonly wifiGateway = inject(WifiEncryptionGateway);

  protected readonly questions = signal<SecurityQuestion[]>([]);
  protected readonly answers = signal<SecurityAnswers>({});
  protected readonly result = signal<SecurityAssessmentResult | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly isLoadingLatest = signal(true);
  protected readonly wifiEncryptionRaw = signal<string | null>(null);

  protected readonly wifiEncryptionStatus = computed(() => evaluateWifiEncryption(this.wifiEncryptionRaw()));
  protected readonly allAnswered = computed(
    () => this.questions().length > 0 && this.questions().every((q) => q.id in this.answers())
  );

  constructor() {
    this.repository.getQuestionnaire().subscribe((questions) => this.questions.set(questions));
    this.wifiGateway.detect().then((raw) => this.wifiEncryptionRaw.set(raw));
    // Si ya respondió antes, se muestra directo el resultado guardado en vez de
    // un formulario vacío: verlo en blanco cada vez se sentía como un bug.
    this.repository.getLatest().subscribe((latest) => {
      this.result.set(latest);
      this.isLoadingLatest.set(false);
    });
  }

  protected answer(questionId: string, value: SecurityAnswerValue): void {
    this.answers.update((current) => ({ ...current, [questionId]: value }));
  }

  protected submit(): void {
    this.isSubmitting.set(true);
    this.repository.submitAnswers(this.answers(), this.wifiEncryptionRaw()).subscribe((result) => {
      this.isSubmitting.set(false);
      this.result.set(result);
    });
  }

  protected restart(): void {
    this.answers.set({});
    this.result.set(null);
  }
}
