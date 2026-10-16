import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiStatusService } from '../../../../core/ai-status/ai-status.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PageScrollController } from '../../../../core/layout/page-scroll.controller';
import { ChatConversationSummary } from '../../../../core/models/security.model';
import { Icon } from '../../../../shared/components/icon/icon';
import { SecurityChatSession } from '../security-chat-session.service';

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

  /** Ampliado ocupa el área visible (en el celular, la pantalla) para leer la respuesta sin bajar la página. */
  protected readonly isExpanded = signal(false);

  protected readonly draft = signal('');
  protected readonly isHistoryOpen = signal(false);
  protected readonly renamingConversationId = signal<string | null>(null);
  protected readonly renameDraft = signal('');

  constructor() {
    // Ampliado, el fondo no se desplaza; al cerrar la vista (o salir de la pantalla) lo libero siempre.
    effect(() => (this.isExpanded() ? this.pageScroll.lockAtTop() : this.pageScroll.unlock()));
    inject(DestroyRef).onDestroy(() => this.pageScroll.unlock());
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
    this.session.send(text);
  }

  private focusDraft(): void {
    // El foco se queda en el campo de texto (si la IA aún enciende está deshabilitado y lo conserva el botón).
    this.draftInput().nativeElement.focus();
  }
}
