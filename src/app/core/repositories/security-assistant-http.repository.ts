import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppLanguage } from '../i18n/i18n.service';
import {
  ChatBriefing,
  ChatConversationSummary,
  ChatReply,
  ChatTopic,
  UserStartableChatTopic,
  ChatMessage,
  SecurityAnswers,
  SecurityAnswerValue,
  SecurityAssessmentResult,
  SecurityQuestion,
  SecurityRecommendation,
  TechnicalEvidence,
} from '../models/security.model';
import { SecurityAssistantRepository } from './security-assistant.repository';

// El cifrado WiFi ya no se pregunta: se detecta solo y se muestra como dato de lectura.
const QUESTIONS: SecurityQuestion[] = [
  { id: 'default-password', textKey: 'user.securityAssistant.questions.defaultPassword' },
  { id: 'firmware-updated', textKey: 'user.securityAssistant.questions.firmwareUpdated' },
  { id: 'guest-network', textKey: 'user.securityAssistant.questions.guestNetwork' },
  { id: 'remote-management-off', textKey: 'user.securityAssistant.questions.remoteManagementOff' },
];

interface BackendRecommendation {
  id: string;
  title_key: string;
  description_key: string;
  priority: number;
}

interface BackendAssessment {
  id: string;
  score: number;
  questionnaire_score: number;
  technical_score: number | null;
  is_partial: boolean;
  technical_measured_at: string | null;
  technical_evidence_reused: boolean;
  recommendations: BackendRecommendation[];
  submitted_at: string;
}

interface BackendConversation {
  id: string;
  title: string | null;
  topic: ChatTopic | null;
  updated_at: string;
}

interface BackendChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

@Injectable()
export class SecurityAssistantHttpRepository extends SecurityAssistantRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/security-assessments`;
  private readonly conversationsUrl = `${environment.apiBaseUrl}/api/conversations`;

  getQuestionnaire(): Observable<SecurityQuestion[]> {
    return of(QUESTIONS);
  }

  submitAnswers(answers: SecurityAnswers, evidence: TechnicalEvidence): Observable<SecurityAssessmentResult> {
    const body: {
      answers: Record<string, SecurityAnswerValue>;
      wifi_encryption_raw: string | null;
      router_open_ports: number[] | null;
    } = {
      answers,
      wifi_encryption_raw: evidence.wifiEncryptionRaw,
      router_open_ports: evidence.routerOpenPorts,
    };
    return this.http.post<BackendAssessment>(this.baseUrl, body).pipe(map((assessment) => this.toResult(assessment)));
  }

  getLatest(): Observable<SecurityAssessmentResult | null> {
    return this.http
      .get<BackendAssessment | null>(`${this.baseUrl}/latest`)
      .pipe(map((assessment) => (assessment ? this.toResult(assessment) : null)));
  }

  listConversations(): Observable<ChatConversationSummary[]> {
    return this.http
      .get<BackendConversation[]>(this.conversationsUrl)
      .pipe(map((conversations) => conversations.map((c) => this.toConversation(c))));
  }

  createConversation(topic?: UserStartableChatTopic): Observable<ChatConversationSummary> {
    return this.http
      .post<BackendConversation>(this.conversationsUrl, { topic: topic ?? null })
      .pipe(map((c) => this.toConversation(c)));
  }

  renameConversation(conversationId: string, title: string): Observable<ChatConversationSummary> {
    return this.http
      .patch<BackendConversation>(`${this.conversationsUrl}/${conversationId}`, { title })
      .pipe(map((c) => this.toConversation(c)));
  }

  getMessages(conversationId: string): Observable<ChatMessage[]> {
    return this.http
      .get<BackendChatMessage[]>(`${this.conversationsUrl}/${conversationId}/messages`)
      .pipe(map((messages) => messages.map((m) => this.toMessage(m))));
  }

  sendMessage(conversationId: string, message: string): Observable<ChatReply> {
    return this.http
      .post<{ reply: string | null; notice_key: string | null; notice_params: Record<string, string> | null }>(`${this.conversationsUrl}/${conversationId}/messages`, {
        message,
        utc_offset_minutes: new Date().getTimezoneOffset(),
      })
      .pipe(
        map((response) => ({
          reply: response.reply,
          noticeKey: response.notice_key,
          noticeParams: response.notice_params,
        }))
      );
  }

  startAssessmentBriefing(assessmentId: string, language: AppLanguage): Observable<ChatBriefing> {
    return this.http
      .post<{ conversation: BackendConversation; messages: BackendChatMessage[] }>(`${this.conversationsUrl}/briefings`, {
        assessment_id: assessmentId,
        language,
        // Para que el asistente escriba las fechas en la hora local del usuario.
        utc_offset_minutes: new Date().getTimezoneOffset(),
      })
      .pipe(
        map((briefing) => ({
          conversation: this.toConversation(briefing.conversation),
          messages: briefing.messages.map((m) => this.toMessage(m)),
        }))
      );
  }

  private toConversation(conversation: BackendConversation): ChatConversationSummary {
    return { id: conversation.id, title: conversation.title, topic: conversation.topic, updatedAt: conversation.updated_at };
  }

  private toMessage(message: BackendChatMessage): ChatMessage {
    return { role: message.role, text: message.content };
  }

  private toResult(assessment: BackendAssessment): SecurityAssessmentResult {
    return {
      id: assessment.id,
      score: assessment.score,
      questionnaireScore: assessment.questionnaire_score,
      technicalScore: assessment.technical_score,
      isPartial: assessment.is_partial,
      technicalMeasuredAt: assessment.technical_measured_at,
      technicalEvidenceReused: assessment.technical_evidence_reused,
      recommendations: assessment.recommendations.map((r) => this.toRecommendation(r)),
      submittedAt: assessment.submitted_at,
    };
  }

  private toRecommendation(recommendation: BackendRecommendation): SecurityRecommendation {
    return {
      id: recommendation.id,
      titleKey: recommendation.title_key,
      descriptionKey: recommendation.description_key,
      priority: recommendation.priority,
    };
  }
}
