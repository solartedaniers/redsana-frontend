import { Observable } from 'rxjs';
import { PlatformMetrics } from '../models/admin.model';

export abstract class AdminMetricsRepository {
  abstract getPlatformMetrics(): Observable<PlatformMetrics>;
}
