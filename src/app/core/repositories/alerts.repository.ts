import { Observable } from 'rxjs';
import { NetworkAlert } from '../models/alert.model';

export abstract class AlertsRepository {
  abstract getAlerts(householdId?: string): Observable<NetworkAlert[]>;
  abstract watchNewAlerts(householdId?: string): Observable<NetworkAlert>;
  abstract acknowledge(alertId: string): Observable<void>;
}
