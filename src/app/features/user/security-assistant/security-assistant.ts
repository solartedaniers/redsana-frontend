import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CHAT_TOPIC_QUERY_PARAM, UserStartableChatTopic } from '../../../core/models/security.model';
import { NetworkStatus } from '../../../core/models/network.model';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { NetworkStatusBadge } from '../../../shared/components/network-status-badge/network-status-badge';
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
  imports: [PageHeader, SecurityAssessmentPanel, SecurityChatPanel, NetworkStatusBadge],
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

  /** Estado real de la última medición; null hasta que llega (o si falla la consulta). */
  protected readonly networkStatus = signal<NetworkStatus | null>(null);

  constructor() {
    inject(NetworkMetricsRepository)
      .getSnapshot()
      .subscribe({ next: (snapshot) => this.networkStatus.set(snapshot.status), error: () => this.networkStatus.set(null) });
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
