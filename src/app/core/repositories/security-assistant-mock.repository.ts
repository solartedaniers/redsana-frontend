import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { SecurityAssistantRepository } from './security-assistant.repository';
import { SecurityAnswers, SecurityAssessmentResult, SecurityQuestion } from '../models/security.model';
import { computeSecurityAssessment } from '../domain/security-score.calculator';

const SIMULATED_LATENCY_MS = 300;

// Los ids coinciden con las claves usadas en security-score.calculator para
// mapear cada pregunta con su recomendación asociada.
const QUESTIONS: SecurityQuestion[] = [
  { id: 'default-password', textKey: 'user.securityAssistant.questions.defaultPassword', weight: 25 },
  { id: 'firmware-updated', textKey: 'user.securityAssistant.questions.firmwareUpdated', weight: 20 },
  { id: 'wpa3-enabled', textKey: 'user.securityAssistant.questions.wpa3Enabled', weight: 20 },
  { id: 'guest-network', textKey: 'user.securityAssistant.questions.guestNetwork', weight: 15 },
  { id: 'remote-management-off', textKey: 'user.securityAssistant.questions.remoteManagementOff', weight: 20 },
];

@Injectable()
export class MockSecurityAssistantRepository extends SecurityAssistantRepository {
  getQuestionnaire(): Observable<SecurityQuestion[]> {
    return of(QUESTIONS).pipe(delay(SIMULATED_LATENCY_MS));
  }

  submitAnswers(answers: SecurityAnswers): Observable<SecurityAssessmentResult> {
    return of(computeSecurityAssessment(QUESTIONS, answers)).pipe(delay(SIMULATED_LATENCY_MS));
  }
}
