import { Observable } from 'rxjs';
import { MonitoredHousehold } from '../models/admin.model';

export abstract class NetworkSupervisionRepository {
  abstract getHouseholds(): Observable<MonitoredHousehold[]>;
}
