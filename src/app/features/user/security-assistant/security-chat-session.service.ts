import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  ChatConversationSummary,
  ChatMessage,
  UserStartableChatTopic,
} from '../../../core/models/security.model';
import { SecurityAssistantRepository } from '../../../core/repositories/security-assistant.repository';

/**
 * Estado y acciones del chat del asistente (conversaciones, mensajes, envío).
 * Se provee en SecurityAssistant, no en root: cada visita a la pantalla
 * arranca con su propia sesión, y el panel de evaluación y el de chat
 * comparten la misma instancia.
 */
@Injectable()
export class SecurityChatSession {
  private readonly repository = inject(SecurityAssistantRepository);
  private readonly i18n = inject(I18nService);

  readonly conversations = signal<ChatConversationSummary[]>([]);
  readonly currentConversationId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly isSending = signal(false);

  loadConversations(selectMostRecent: boolean): void {
    this.repository.listConversations().subscribe((list) => {
      this.conversations.set(list);
      if (selectMostRecent && list.length > 0 && this.currentConversationId() === null) {
        this.selectConversation(list[0].id);
      }
    });
  }

  selectConversation(conversationId: string): void {
    this.currentConversationId.set(conversationId);
    this.repository.getMessages(conversationId).subscribe((messages) => this.messages.set(messages));
  }

  startNewConversation(): void {
    this.repository.createConversation().subscribe((conversation) => {
      this.addConversation(conversation);
      this.messages.set([]);
    });
  }

  /** Conversación sobre un tema que abre otra pantalla (p. ej. Modo familiar), con su saludo inicial. */
  startTopicConversation(topic: UserStartableChatTopic, introKey: string): Observable<ChatConversationSummary> {
    return this.repository.createConversation(topic).pipe(
      tap((conversation) => {
        this.addConversation(conversation);
        this.messages.set([{ role: 'assistant', text: introKey, isTranslationKey: true }]);
      })
    );
  }

  rename(conversationId: string, title: string): void {
    this.repository.renameConversation(conversationId, title).subscribe((updated) => {
      this.conversations.update((list) => list.map((c) => (c.id === conversationId ? updated : c)));
    });
  }

  /** El asistente abre la conversación con el resumen de esta evaluación (una sola vez por evaluación). */
  startAssessmentBriefing(assessmentId: string): void {
    this.isSending.set(true);
    this.repository.startAssessmentBriefing(assessmentId, this.i18n.language()).subscribe({
      next: ({ conversation, messages }) => {
        this.conversations.update((list) => [conversation, ...list.filter((c) => c.id !== conversation.id)]);
        this.currentConversationId.set(conversation.id);
        this.messages.set(messages);
        this.isSending.set(false);
      },
      // Sin resumen no se muestra nada inventado: el chat queda disponible como siempre.
      error: () => this.isSending.set(false),
    });
  }

  send(text: string): void {
    if (!text || this.isSending()) {
      return;
    }
    const existingConversationId = this.currentConversationId();
    if (existingConversationId) {
      this.dispatch(existingConversationId, text);
      return;
    }
    // Primer mensaje sin conversación activa: se crea una silenciosamente
    // (así "solo escribir" funciona sin exigir un click previo en "Nueva conversación").
    this.repository.createConversation().subscribe((conversation) => {
      this.addConversation(conversation);
      this.dispatch(conversation.id, text);
    });
  }

  private addConversation(conversation: ChatConversationSummary): void {
    this.conversations.update((list) => [conversation, ...list]);
    this.currentConversationId.set(conversation.id);
  }

  private dispatch(conversationId: string, text: string): void {
    this.messages.update((messages) => [...messages, { role: 'user', text }]);
    this.isSending.set(true);
    this.repository.sendMessage(conversationId, text).subscribe({
      next: ({ reply, noticeKey, noticeParams }) => {
        const notice: ChatMessage[] = noticeKey
          ? [{ role: 'assistant', text: noticeKey, isTranslationKey: true, translationParams: noticeParams ?? undefined }]
          : [];
        if (reply === null) {
          // El mensaje no se guardó (p. ej. traía una contraseña): se quita de la
          // pantalla y en su lugar se muestra el aviso.
          this.messages.update((messages) => [...messages.slice(0, -1), ...notice]);
          this.isSending.set(false);
          return;
        }
        this.messages.update((messages) => [...messages, { role: 'assistant', text: reply }, ...notice]);
        this.isSending.set(false);
        // Refresca título autogenerado (primer mensaje) y orden por actividad reciente.
        this.loadConversations(false);
      },
      error: () => {
        this.messages.update((messages) => [
          ...messages,
          { role: 'assistant', text: 'user.securityAssistant.chat.errorReply', isTranslationKey: true },
        ]);
        this.isSending.set(false);
      },
    });
  }
}
