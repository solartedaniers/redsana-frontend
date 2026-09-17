import { Observable } from 'rxjs';
import { SecurityAnswers, SecurityAssessmentResult, SecurityQuestion } from '../models/security.model';

export abstract class SecurityAssistantRepository {
  abstract getQuestionnaire(): Observable<SecurityQuestion[]>;
  abstract submitAnswers(answers: SecurityAnswers): Observable<SecurityAssessmentResult>;
}
