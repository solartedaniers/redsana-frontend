import { Observable } from 'rxjs';
import { AiStatusReport } from '../models/ai.model';

export abstract class AiStatusRepository {
  /** Lee el estado que mantiene el calentamiento del backend; no despierta la IA. */
  abstract getStatus(): Observable<AiStatusReport>;
  /** Pide despertar la IA (o reiniciar un intento terminado) y devuelve el estado de ese momento. */
  abstract warmUp(): Observable<AiStatusReport>;
}
