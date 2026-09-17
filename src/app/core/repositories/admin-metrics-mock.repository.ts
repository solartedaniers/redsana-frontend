import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { AdminMetricsRepository } from './admin-metrics.repository';
import { PlatformMetrics } from '../models/admin.model';

const SIMULATED_LATENCY_MS = 300;

@Injectable()
export class MockAdminMetricsRepository extends AdminMetricsRepository {
  getPlatformMetrics(): Observable<PlatformMetrics> {
    const metrics: PlatformMetrics = {
      totalUsers: 128,
      monitoredHouseholds: 96,
      activeAlerts: 7,
      averageSecurityScore: 74,
    };
    return of(metrics).pipe(delay(SIMULATED_LATENCY_MS));
  }
}
