import { Observable } from 'rxjs';
import {
  ChatConversationSummary,
  ChatMessage,
  SecurityAnswers,
  SecurityAssessmentResult,
  SecurityQuestion,
} from '../models/security.model';

export abstract class SecurityAssistantRepository {
  abstract getQuestionnaire(): Observable<SecurityQuestion[]>;
  abstract submitAnswers(answers: SecurityAnswers, wifiEncryptionRaw: string | null): Observable<SecurityAssessmentResult>;
  /** null cuando el usuario nunca ha enviado el cuestionario. */
  abstract getLatest(): Observable<SecurityAssessmentResult | null>;

  /** Historial de conversaciones del chat, ordenado por actividad reciente. */
  abstract listConversations(): Observable<ChatConversationSummary[]>;
  abstract createConversation(): Observable<ChatConversationSummary>;
  abstract renameConversation(conversationId: string, title: string): Observable<ChatConversationSummary>;
  abstract getMessages(conversationId: string): Observable<ChatMessage[]>;
  abstract sendMessage(conversationId: string, message: string): Observable<string>;
}
