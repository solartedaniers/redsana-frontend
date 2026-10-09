import { Observable } from 'rxjs';
import { AppLanguage } from '../i18n/i18n.service';
import {
  ChatBriefing,
  ChatReply,
  UserStartableChatTopic,
  ChatConversationSummary,
  ChatMessage,
  SecurityAnswers,
  SecurityAssessmentResult,
  SecurityQuestion,
  TechnicalEvidence,
} from '../models/security.model';

export abstract class SecurityAssistantRepository {
  abstract getQuestionnaire(): Observable<SecurityQuestion[]>;
  abstract submitAnswers(answers: SecurityAnswers, evidence: TechnicalEvidence): Observable<SecurityAssessmentResult>;
  /** null cuando el usuario nunca envió el cuestionario. */
  abstract getLatest(): Observable<SecurityAssessmentResult | null>;

  /** Conversaciones del chat, de la más reciente a la más vieja. */
  abstract listConversations(): Observable<ChatConversationSummary[]>;
  abstract createConversation(topic?: UserStartableChatTopic): Observable<ChatConversationSummary>;
  abstract renameConversation(conversationId: string, title: string): Observable<ChatConversationSummary>;
  abstract getMessages(conversationId: string): Observable<ChatMessage[]>;
  abstract sendMessage(conversationId: string, message: string): Observable<ChatReply>;
  /** Primer mensaje del asistente tras una evaluación; idempotente, uno por evaluación. */
  abstract startAssessmentBriefing(assessmentId: string, language: AppLanguage): Observable<ChatBriefing>;
}
