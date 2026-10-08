import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ChatConversationSummary } from '../../../../core/models/security.model';
import { Icon } from '../../../../shared/components/icon/icon';
import { SecurityChatSession } from '../security-chat-session.service';

/** Interfaz del chat; el estado de la conversación vive en SecurityChatSession, aquí solo el de la vista. */
@Component({
  selector: 'app-security-chat-panel',
  imports: [FormsModule, TranslatePipe, Icon],
  templateUrl: './security-chat-panel.html',
  styleUrl: './security-chat-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityChatPanel {
  protected readonly session = inject(SecurityChatSession);

  protected readonly draft = signal('');
  protected readonly isHistoryOpen = signal(false);
  protected readonly renamingConversationId = signal<string | null>(null);
  protected readonly renameDraft = signal('');

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
    if (!text || this.session.isSending()) {
      return;
    }
    this.draft.set('');
    this.session.send(text);
  }
}
