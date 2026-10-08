import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { evaluateWifiEncryption } from '../../../../core/domain/security-score.calculator';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  SecurityAnswers,
  SecurityAnswerValue,
  SecurityAssessmentResult,
  SecurityQuestion,
} from '../../../../core/models/security.model';
import { SecurityAssistantRepository } from '../../../../core/repositories/security-assistant.repository';
import { SecurityEvidenceCollector } from '../../../../core/security-evidence/security-evidence.collector';
import { WifiEncryptionGateway } from '../../../../core/wifi-encryption/wifi-encryption.gateway';
import { ScoreGauge } from '../../../../shared/components/score-gauge/score-gauge';
import { PrescriptionList } from '../prescription-list/prescription-list';

/** Cuestionario de seguridad y su resultado; avisa con (assessed) cuando hay una evaluación nueva. */
@Component({
  selector: 'app-security-assessment-panel',
  imports: [ScoreGauge, PrescriptionList, TranslatePipe, DatePipe, FormsModule],
  templateUrl: './security-assessment-panel.html',
  styleUrl: './security-assessment-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityAssessmentPanel {
  private readonly repository = inject(SecurityAssistantRepository);
  private readonly wifiGateway = inject(WifiEncryptionGateway);
  private readonly evidenceCollector = inject(SecurityEvidenceCollector);

  /** Id de la evaluación recién guardada. */
  readonly assessed = output<string>();

  protected readonly questions = signal<SecurityQuestion[]>([]);
  protected readonly answers = signal<SecurityAnswers>({});
  protected readonly result = signal<SecurityAssessmentResult | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly isLoadingLatest = signal(true);
  protected readonly wifiEncryptionRaw = signal<string | null>(null);
  protected readonly isWifiDetectionAvailable = this.wifiGateway.isAvailable;

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

  protected async submit(): Promise<void> {
    this.isSubmitting.set(true);
    // El análisis técnico (cifrado + puertos del router) se mide justo al
    // enviar, para que el puntaje refleje la red de este momento.
    const evidence = await this.evidenceCollector.collect();
    this.repository.submitAnswers(this.answers(), evidence).subscribe((result) => {
      this.isSubmitting.set(false);
      this.result.set(result);
      this.assessed.emit(result.id);
    });
  }

  protected restart(): void {
    this.answers.set({});
    this.result.set(null);
  }
}
