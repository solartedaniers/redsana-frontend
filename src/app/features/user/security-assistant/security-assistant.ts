import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SecurityAssistantRepository } from '../../../core/repositories/security-assistant.repository';
import {
  CHAT_TOPIC_QUERY_PARAM,
  ChatConversationSummary,
  ChatMessage,
  SecurityAnswers,
  SecurityAnswerValue,
  SecurityAssessmentResult,
  SecurityQuestion,
} from '../../../core/models/security.model';
import { WifiEncryptionGateway } from '../../../core/wifi-encryption/wifi-encryption.gateway';
import { SecurityEvidenceCollector } from '../../../core/security-evidence/security-evidence.collector';
import { evaluateWifiEncryption } from '../../../core/domain/security-score.calculator';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ScoreGauge } from '../../../shared/components/score-gauge/score-gauge';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-security-assistant',
  imports: [PageHeader, ScoreGauge, TranslatePipe, DatePipe, FormsModule, Icon],
  templateUrl: './security-assistant.html',
  styleUrl: './security-assistant.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityAssistant {
  private readonly repository = inject(SecurityAssistantRepository);
  private readonly wifiGateway = inject(WifiEncryptionGateway);
  private readonly evidenceCollector = inject(SecurityEvidenceCollector);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatPanel = viewChild<ElementRef<HTMLElement>>('chatPanel');

  protected readonly questions = signal<SecurityQuestion[]>([]);
  protected readonly answers = signal<SecurityAnswers>({});
  protected readonly result = signal<SecurityAssessmentResult | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly isLoadingLatest = signal(true);
  protected readonly wifiEncryptionRaw = signal<string | null>(null);
  protected readonly isWifiDetectionAvailable = this.wifiGateway.isAvailable;

  protected readonly chatMessages = signal<ChatMessage[]>([]);
  protected readonly chatDraft = signal('');
  protected readonly isSendingChat = signal(false);
  protected readonly conversations = signal<ChatConversationSummary[]>([]);
  protected readonly currentConversationId = signal<string | null>(null);
  protected readonly isHistoryOpen = signal(false);
  protected readonly renamingConversationId = signal<string | null>(null);
  protected readonly renameDraft = signal('');

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
    // Otra pantalla (p. ej. Modo familiar) puede abrir el asistente en un tema.
    const startsFamilyMode = this.route.snapshot.queryParamMap.get(CHAT_TOPIC_QUERY_PARAM) === 'family_mode';
    this.loadConversations(!startsFamilyMode);
    if (startsFamilyMode) {
      this.startFamilyModeConversation();
    }
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
      this.startAssessmentBriefing(result.id);
    });
  }

  /** El asistente abre la conversación con el resumen de esta evaluación (una sola vez por evaluación). */
  private startAssessmentBriefing(assessmentId: string): void {
    this.isSendingChat.set(true);
    this.repository.startAssessmentBriefing(assessmentId, this.i18n.language()).subscribe({
      next: ({ conversation, messages }) => {
        this.conversations.update((list) => [conversation, ...list.filter((c) => c.id !== conversation.id)]);
        this.currentConversationId.set(conversation.id);
        this.chatMessages.set(messages);
        this.isSendingChat.set(false);
      },
      // Sin resumen no se muestra nada inventado: el chat queda disponible como siempre.
      error: () => this.isSendingChat.set(false),
    });
  }

  private startFamilyModeConversation(): void {
    this.repository.createConversation('family_mode').subscribe((conversation) => {
      this.conversations.update((list) => [conversation, ...list]);
      this.currentConversationId.set(conversation.id);
      this.chatMessages.set([
        { role: 'assistant', text: 'user.securityAssistant.chat.familyModeIntro', isTranslationKey: true },
      ]);
      // Sin el query param, recargar la página no abre otra conversación igual.
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      this.chatPanel()?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    });
  }

  protected restart(): void {
    this.answers.set({});
    this.result.set(null);
  }

  protected toggleHistory(): void {
    this.isHistoryOpen.update((open) => !open);
  }

  protected selectConversation(conversationId: string): void {
    this.currentConversationId.set(conversationId);
    this.isHistoryOpen.set(false);
    this.repository.getMessages(conversationId).subscribe((messages) => this.chatMessages.set(messages));
  }

  protected startNewConversation(): void {
    this.repository.createConversation().subscribe((conversation) => {
      this.conversations.update((list) => [conversation, ...list]);
      this.currentConversationId.set(conversation.id);
      this.chatMessages.set([]);
      this.isHistoryOpen.set(false);
    });
  }

  protected startRename(conversation: ChatConversationSummary, event: Event): void {
    event.stopPropagation();
    this.renamingConversationId.set(conversation.id);
    this.renameDraft.set(conversation.title ?? '');
  }

  protected confirmRename(): void {
    const conversationId = this.renamingConversationId();
    const title = this.renameDraft().trim();
    if (!conversationId || !title) {
      this.renamingConversationId.set(null);
      return;
    }
    this.repository.renameConversation(conversationId, title).subscribe((updated) => {
      this.conversations.update((list) => list.map((c) => (c.id === conversationId ? updated : c)));
      this.renamingConversationId.set(null);
    });
  }

  protected sendChatMessage(): void {
    const text = this.chatDraft().trim();
    if (!text || this.isSendingChat()) {
      return;
    }
    this.chatDraft.set('');

    const existingConversationId = this.currentConversationId();
    if (existingConversationId) {
      this.dispatchChatMessage(existingConversationId, text);
      return;
    }
    // Primer mensaje sin conversación activa: se crea una silenciosamente
    // (así "solo escribir" funciona sin exigir un click previo en "Nueva conversación").
    this.repository.createConversation().subscribe((conversation) => {
      this.conversations.update((list) => [conversation, ...list]);
      this.currentConversationId.set(conversation.id);
      this.dispatchChatMessage(conversation.id, text);
    });
  }

  private dispatchChatMessage(conversationId: string, text: string): void {
    this.chatMessages.update((messages) => [...messages, { role: 'user', text }]);
    this.isSendingChat.set(true);
    this.repository.sendMessage(conversationId, text).subscribe({
      next: ({ reply, noticeKey, noticeParams }) => {
        const notice: ChatMessage[] = noticeKey
          ? [{ role: 'assistant', text: noticeKey, isTranslationKey: true, translationParams: noticeParams ?? undefined }]
          : [];
        if (reply === null) {
          // El mensaje no se guardó (p. ej. traía una contraseña): se quita de la
          // pantalla y en su lugar se muestra el aviso.
          this.chatMessages.update((messages) => [...messages.slice(0, -1), ...notice]);
          this.isSendingChat.set(false);
          return;
        }
        this.chatMessages.update((messages) => [...messages, { role: 'assistant', text: reply }, ...notice]);
        this.isSendingChat.set(false);
        // Refresca título autogenerado (primer mensaje) y orden por actividad reciente.
        this.loadConversations(false);
      },
      error: () => {
        this.chatMessages.update((messages) => [
          ...messages,
          { role: 'assistant', text: 'user.securityAssistant.chat.errorReply', isTranslationKey: true },
        ]);
        this.isSendingChat.set(false);
      },
    });
  }

  private loadConversations(selectMostRecent: boolean): void {
    this.repository.listConversations().subscribe((list) => {
      this.conversations.set(list);
      if (selectMostRecent && list.length > 0 && this.currentConversationId() === null) {
        this.selectConversation(list[0].id);
      }
    });
  }
}
