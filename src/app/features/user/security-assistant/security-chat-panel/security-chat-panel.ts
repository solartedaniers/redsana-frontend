import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiStatusService } from '../../../../core/ai-status/ai-status.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PageScrollController } from '../../../../core/layout/page-scroll.controller';
import { ChatConversationSummary } from '../../../../core/models/security.model';
import { Icon } from '../../../../shared/components/icon/icon';
import { SecurityChatSession } from '../security-chat-session.service';
import { ChatScrollAnchor } from './chat-scroll-anchor';

/** Vista del chat; el estado de la conversación vive en SecurityChatSession. */
@Component({
  selector: 'app-security-chat-panel',
  imports: [FormsModule, TranslatePipe, Icon],
  templateUrl: './security-chat-panel.html',
  styleUrl: './security-chat-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityChatPanel {
  protected readonly session = inject(SecurityChatSession);
  /** Mientras la IA no esté lista el chat queda deshabilitado con un aviso, en vez de fallar al enviar. */
  protected readonly aiStatus = inject(AiStatusService);
  private readonly pageScroll = inject(PageScrollController);
  private readonly draftInput = viewChild.required<ElementRef<HTMLInputElement>>('draftInput');
  private readonly messageList = viewChild.required<ElementRef<HTMLElement>>('messageList');
  private readonly scrollAnchor = inject(ChatScrollAnchor);
  /** Desde que envío hasta que llega la respuesta, mantengo la pregunta arriba de la lista. */
  private isAnchoringQuestion = false;

  /** Ampliado ocupa el área visible (en el celular, la pantalla) para leer la respuesta sin bajar la página. */
  protected readonly isExpanded = signal(false);

  protected readonly draft = signal('');
  protected readonly isHistoryOpen = signal(false);
  protected readonly renamingConversationId = signal<string | null>(null);
  protected readonly renameDraft = signal('');

  constructor() {
    // Abrir el chat es querer usar la IA: si se durmió o quedó no disponible, la despierto.
    this.aiStatus.wakeUp();
    // Ampliado, el fondo no se desplaza; al cerrar la vista (o salir de la pantalla) lo libero siempre.
    effect(() => (this.isExpanded() ? this.pageScroll.lockAtTop() : this.pageScroll.unlock()));
    inject(DestroyRef).onDestroy(() => this.pageScroll.unlock());
    // Tras pintar la pregunta (y luego la respuesta) la dejo arriba: se lee el inicio de la respuesta sin bajar.
    afterRenderEffect(() => {
      this.session.messages();
      const isWaitingReply = this.session.isSending();
      if (!this.isAnchoringQuestion) {
        return;
      }
      this.anchorLastQuestion();
      if (!isWaitingReply) {
        this.isAnchoringQuestion = false;
      }
    });
  }

  protected toggleExpanded(): void {
    this.isExpanded.update((expanded) => !expanded);
    this.focusDraft();
  }

  protected collapse(): void {
    if (!this.isExpanded()) {
      return;
    }
    this.isExpanded.set(false);
    this.focusDraft();
  }

  protected toggleHistory(): void {
    this.isHistoryOpen.update((open) => !open);
  }

  protected selectConversation(conversationId: string): void {
    this.session.selectConversation(conversationId);
    this.isHistoryOpen.set(false);
  }

  protected startNewConversation(): void {
    this.session.startNewConversation();
    this.isHistoryOpen.set(false);
  }

  protected startRename(conversation: ChatConversationSummary, event: Event): void {
    event.stopPropagation();
    this.renamingConversationId.set(conversation.id);
    this.renameDraft.set(conversation.title ?? '');
  }

  protected confirmRename(): void {
    const conversationId = this.renamingConversationId();
    const title = this.renameDraft().trim();
    this.renamingConversationId.set(null);
    if (conversationId && title) {
      this.session.rename(conversationId, title);
    }
  }

  protected send(): void {
    const text = this.draft().trim();
    if (!text || this.session.isSending() || !this.aiStatus.isReady()) {
      return;
    }
    this.draft.set('');
    this.isAnchoringQuestion = true;
    if (!this.isExpanded()) {
      // Minimizado puede estar fuera de la pantalla: lo traigo para ver la pregunta y la respuesta.
      this.scrollAnchor.bringIntoView(this.messageList().nativeElement);
    }
    this.session.send(text);
    // Si envió con el botón, el foco quedó en él: lo devuelvo al campo para seguir escribiendo.
    this.focusDraft();
  }

  private anchorLastQuestion(): void {
    const list = this.messageList().nativeElement;
    const questions = list.querySelectorAll<HTMLElement>('.chat-bubble--user');
    const lastQuestion = questions.item(questions.length - 1);
    if (lastQuestion) {
      this.scrollAnchor.showAtTop(list, lastQuestion);
    }
  }

  private focusDraft(): void {
    // El foco se queda en el campo de texto (si la IA aún enciende está deshabilitado y lo conserva el botón).
    this.draftInput().nativeElement.focus();
  }
}
