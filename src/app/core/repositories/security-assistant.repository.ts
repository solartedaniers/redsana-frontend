import { Observable } from 'rxjs';
import { SecurityAnswers, SecurityAssessmentResult, SecurityQuestion } from '../models/security.model';

export abstract class SecurityAssistantRepository {
  abstract getQuestionnaire(): Observable<SecurityQuestion[]>;
  abstract submitAnswers(answers: SecurityAnswers, wifiEncryptionRaw: string | null): Observable<SecurityAssessmentResult>;
  /** null cuando el usuario nunca ha enviado el cuestionario. */
  abstract getLatest(): Observable<SecurityAssessmentResult | null>;
  abstract sendChatMessage(message: string): Observable<string>;
}
