import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, interval, map, mergeMap, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkAlert } from '../models/alert.model';
import { AlertsRepository } from './alerts.repository';

const NEW_ALERTS_POLL_INTERVAL_MS = 10000;

interface BackendAlert {
  id: string;
  type: NetworkAlert['type'];
  severity: NetworkAlert['severity'];
  message_key: string;
  message_params?: Record<string, string | number>;
  timestamp: string;
  acknowledged: boolean;
}

@Injectable()
export class AlertsHttpRepository extends AlertsRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/alerts`;

  getAlerts(): Observable<NetworkAlert[]> {
    return this.http.get<BackendAlert[]>(this.baseUrl).pipe(map((alerts) => alerts.map((alert) => this.toAlert(alert))));
  }

  watchNewAlerts(): Observable<NetworkAlert> {
    // Sin push real del backend: se hace polling a /new con un cursor "since" que
    // avanza al timestamp de la ultima alerta vista, para no repetir ni perder alertas.
    let since = new Date().toISOString();
    return interval(NEW_ALERTS_POLL_INTERVAL_MS).pipe(
      switchMap(() => this.http.get<BackendAlert[]>(`${this.baseUrl}/new`, { params: { since } })),
      tap((alerts) => {
        if (alerts.length > 0) {
          since = alerts[alerts.length - 1].timestamp;
        }
      }),
      mergeMap((alerts) => from(alerts.map((alert) => this.toAlert(alert))))
    );
  }

  acknowledge(alertId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${alertId}/acknowledge`, {});
  }

  private toAlert(alert: BackendAlert): NetworkAlert {
    return {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      messageKey: alert.message_key,
      messageParams: alert.message_params,
      timestamp: alert.timestamp,
      acknowledged: alert.acknowledged,
    };
  }
}
