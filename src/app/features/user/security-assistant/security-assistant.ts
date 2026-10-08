import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CHAT_TOPIC_QUERY_PARAM, UserStartableChatTopic } from '../../../core/models/security.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { SecurityAssessmentPanel } from './security-assessment-panel/security-assessment-panel';
import { SecurityChatPanel } from './security-chat-panel/security-chat-panel';
import { SecurityChatSession } from './security-chat-session.service';

const FAMILY_MODE_TOPIC: UserStartableChatTopic = 'family_mode';
const FAMILY_MODE_INTRO_KEY = 'user.securityAssistant.chat.familyModeIntro';

/**
 * Pantalla del asistente: compone el panel de evaluación y el de chat, y los
 * conecta (una evaluación nueva abre su resumen en el chat). La sesión del chat
 * se provee aquí para que ambos paneles compartan la misma.
 */
@Component({
  selector: 'app-security-assistant',
  imports: [PageHeader, TranslatePipe, SecurityAssessmentPanel, SecurityChatPanel],
  providers: [SecurityChatSession],
  templateUrl: './security-assistant.html',
  styleUrl: './security-assistant.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityAssistant {
  private readonly chat = inject(SecurityChatSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatPanel = viewChild(SecurityChatPanel, { read: ElementRef });

  constructor() {
    // Otra pantalla (p. ej. Modo familiar) puede abrir el asistente en un tema.
    const startsFamilyMode = this.route.snapshot.queryParamMap.get(CHAT_TOPIC_QUERY_PARAM) === FAMILY_MODE_TOPIC;
    this.chat.loadConversations(!startsFamilyMode);
    if (startsFamilyMode) {
      this.chat.startTopicConversation(FAMILY_MODE_TOPIC, FAMILY_MODE_INTRO_KEY).subscribe(() => {
        // Sin el query param, recargar la página no abre otra conversación igual.
        void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        this.chatPanel()?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  protected onAssessed(assessmentId: string): void {
    this.chat.startAssessmentBriefing(assessmentId);
  }
}
