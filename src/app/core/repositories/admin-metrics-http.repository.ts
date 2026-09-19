import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlatformMetrics } from '../models/admin.model';
import { AdminMetricsRepository } from './admin-metrics.repository';

interface BackendPlatformMetrics {
  total_users: number;
  monitored_households: number;
  active_alerts: number;
  average_security_score: number;
}

@Injectable()
export class AdminMetricsHttpRepository extends AdminMetricsRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/admin/metrics`;

  getPlatformMetrics(): Observable<PlatformMetrics> {
    return this.http.get<BackendPlatformMetrics>(this.baseUrl).pipe(
      map((metrics) => ({
        totalUsers: metrics.total_users,
        monitoredHouseholds: metrics.monitored_households,
        activeAlerts: metrics.active_alerts,
        averageSecurityScore: metrics.average_security_score,
      }))
    );
  }
}
