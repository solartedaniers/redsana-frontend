import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, filter, map, of, switchMap, take, tap } from 'rxjs';
import { AiStatusService } from '../../../core/ai-status/ai-status.service';
import { AiWarmingUpError } from '../../../core/ai-status/ai-warming-up.error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ChatConversationSummary, ChatMessage, UserStartableChatTopic } from '../../../core/models/security.model';
import { SecurityAssistantRepository } from '../../../core/repositories/security-assistant.repository';

/** Estado del chat; se provee en SecurityAssistant para que cada visita arranque con su propia sesión. */
@Injectable()
export class SecurityChatSession {
  private readonly repository = inject(SecurityAssistantRepository);
  private readonly i18n = inject(I18nService);
  private readonly aiStatus = inject(AiStatusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly aiReady$ = toObservable(this.aiStatus.isReady);

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

  /** Conversación sobre un tema que abre otra pantalla, con su saludo inicial. */
  startTopicConversation(topic: UserStartableChatTopic, introKey: string): Observable<ChatConversationSummary> {
    return this.repository.createConversation(topic).pipe(
      tap((conversation) => {
        this.addConversation(conversation);
        this.messages.set([{ role: 'assistant', text: introKey, isTranslationKey: true }]);
      }),
    );
  }

  rename(conversationId: string, title: string): void {
    this.repository.renameConversation(conversationId, title).subscribe((updated) => {
      this.conversations.update((list) => list.map((c) => (c.id === conversationId ? updated : c)));
    });
  }

  /** El asistente abre la conversación con el resumen de esta evaluación, una sola vez. */
  startAssessmentBriefing(assessmentId: string): void {
    // La evaluación ya quedó guardada (no usa IA); el resumen sí, así que lo pido cuando la IA esté lista.
    this.whenAiReady()
      .pipe(
        tap(() => this.isSending.set(true)),
        switchMap(() => this.repository.startAssessmentBriefing(assessmentId, this.i18n.language())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ conversation, messages }) => {
          this.conversations.update((list) => [conversation, ...list.filter((c) => c.id !== conversation.id)]);
          this.currentConversationId.set(conversation.id);
          this.messages.set(messages);
          this.isSending.set(false);
        },
        error: (error: unknown) => {
          this.isSending.set(false);
          // Se durmió justo antes de pedirlo: la despierto y lo pido otra vez cuando vuelva a estar lista.
          if (error instanceof AiWarmingUpError) {
            this.aiStatus.reportWarmingUp();
            this.startAssessmentBriefing(assessmentId);
          }
          // Si no hay resumen no invento nada: el chat sigue disponible como siempre.
        },
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
    // Sin conversación activa creo una en silencio, para que baste con escribir.
    this.repository.createConversation().subscribe((conversation) => {
      this.addConversation(conversation);
      this.dispatch(conversation.id, text);
    });
  }

  private whenAiReady(): Observable<void> {
    return this.aiStatus.isReady()
      ? of(undefined)
      : this.aiReady$.pipe(
          filter(Boolean),
          take(1),
          map(() => undefined),
        );
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
          ? [
              {
                role: 'assistant',
                text: noticeKey,
                isTranslationKey: true,
                translationParams: noticeParams ?? undefined,
              },
            ]
          : [];
        if (reply === null) {
          // El mensaje no se guardó (p. ej. traía una contraseña): lo quito y muestro el aviso.
          this.messages.update((messages) => [...messages.slice(0, -1), ...notice]);
          this.isSending.set(false);
          return;
        }
        this.messages.update((messages) => [...messages, { role: 'assistant', text: reply }, ...notice]);
        this.isSending.set(false);
        // Refresco el título autogenerado y el orden por actividad reciente.
        this.loadConversations(false);
      },
      error: (error: unknown) => {
        // "Encendiendo" no es un fallo: aviso que espere a "IA lista" y despierto la IA de nuevo.
        const isWarmingUp = error instanceof AiWarmingUpError;
        if (isWarmingUp) {
          this.aiStatus.reportWarmingUp();
        }
        const replyKey = isWarmingUp
          ? 'user.securityAssistant.chat.aiWarmingUpReply'
          : 'user.securityAssistant.chat.errorReply';
        this.messages.update((messages) => [
          ...messages,
          { role: 'assistant', text: replyKey, isTranslationKey: true },
        ]);
        this.isSending.set(false);
      },
    });
  }
}
