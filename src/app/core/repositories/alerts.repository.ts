import { Observable } from 'rxjs';
import { NetworkAlert } from '../models/alert.model';

export abstract class AlertsRepository {
  abstract getAlerts(householdId?: string): Observable<NetworkAlert[]>;
  /** Emite una nueva alerta cada vez que "ocurre" - simula push en tiempo real. */
  abstract watchNewAlerts(householdId?: string): Observable<NetworkAlert>;
  abstract acknowledge(alertId: string): Observable<void>;
}
