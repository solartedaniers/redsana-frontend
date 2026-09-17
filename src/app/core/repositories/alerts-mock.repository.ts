import { Injectable } from '@angular/core';
import { Observable, delay, interval, map, of } from 'rxjs';
import { AlertsRepository } from './alerts.repository';
import { NetworkAlert } from '../models/alert.model';

const SIMULATED_LATENCY_MS = 300;
const NEW_ALERT_INTERVAL_MS = 20000;

@Injectable()
export class MockAlertsRepository extends AlertsRepository {
  private alerts: NetworkAlert[] = [
    {
      id: 'alert-1',
      type: 'outage',
      severity: 'warning',
      messageKey: 'user.alertsCenter.messages.briefOutage',
      messageParams: { minutes: 2 },
      timestamp: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      acknowledged: false,
    },
    {
      id: 'alert-2',
      type: 'prediction',
      severity: 'info',
      messageKey: 'user.alertsCenter.messages.congestionForecast',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      acknowledged: true,
    },
  ];

  getAlerts(): Observable<NetworkAlert[]> {
    return of([...this.alerts]).pipe(delay(SIMULATED_LATENCY_MS));
  }

  watchNewAlerts(): Observable<NetworkAlert> {
    return interval(NEW_ALERT_INTERVAL_MS).pipe(
      map(() => {
        const alert: NetworkAlert = {
          id: crypto.randomUUID(),
          type: 'prediction',
          severity: 'warning',
          messageKey: 'user.alertsCenter.messages.latencySpikePredicted',
          timestamp: new Date().toISOString(),
          acknowledged: false,
        };
        this.alerts = [alert, ...this.alerts];
        return alert;
      })
    );
  }

  acknowledge(alertId: string): Observable<void> {
    this.alerts = this.alerts.map((alert) =>
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    );
    return of(undefined).pipe(delay(150));
  }
}
