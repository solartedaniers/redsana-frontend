import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SecurityAnswers,
  SecurityAnswerValue,
  SecurityAssessmentResult,
  SecurityQuestion,
  SecurityRecommendation,
} from '../models/security.model';
import { SecurityAssistantRepository } from './security-assistant.repository';

// El cifrado WiFi (antes 'wpa3-enabled') ya no se pregunta: se auto-detecta
// via WifiEncryptionGateway y se informa como dato de solo lectura.
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
  score: number;
  recommendations: BackendRecommendation[];
  submitted_at: string;
}

@Injectable()
export class SecurityAssistantHttpRepository extends SecurityAssistantRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/security-assessments`;

  getQuestionnaire(): Observable<SecurityQuestion[]> {
    return of(QUESTIONS);
  }

  submitAnswers(answers: SecurityAnswers, wifiEncryptionRaw: string | null): Observable<SecurityAssessmentResult> {
    const body: { answers: Record<string, SecurityAnswerValue>; wifi_encryption_raw: string | null } = {
      answers,
      wifi_encryption_raw: wifiEncryptionRaw,
    };
    return this.http.post<BackendAssessment>(this.baseUrl, body).pipe(map((assessment) => this.toResult(assessment)));
  }

  getLatest(): Observable<SecurityAssessmentResult | null> {
    return this.http
      .get<BackendAssessment | null>(`${this.baseUrl}/latest`)
      .pipe(map((assessment) => (assessment ? this.toResult(assessment) : null)));
  }

  private toResult(assessment: BackendAssessment): SecurityAssessmentResult {
    return {
      score: assessment.score,
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
