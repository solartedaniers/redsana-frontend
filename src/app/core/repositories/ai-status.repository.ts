import { Observable } from 'rxjs';
import { AiAvailability } from '../models/ai.model';

export abstract class AiStatusRepository {
  /** Consulta liviana del estado actual de la IA. */
  abstract getStatus(): Observable<AiAvailability>;
  /** Pide despertar la IA y devuelve el estado de ese momento; el calentamiento sigue en el backend. */
  abstract warmUp(): Observable<AiAvailability>;
}
