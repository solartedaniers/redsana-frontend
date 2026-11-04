import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, filter, from, interval, map, merge, mergeMap, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkAlert } from '../models/alert.model';
import { AlertsRepository } from './alerts.repository';
import { LiveUpdates } from '../realtime/live-updates';
import { LIVE_UPDATES_CONFIG } from '../realtime/live-updates.config';

// Alertas viejas guardadas sin la ruta completa del diccionario; sin el prefijo se veía la clave cruda.
const LEGACY_ALERT_KEY_PREFIX = 'alertsCenter.';
const ALERT_KEY_NAMESPACE = 'user.';

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
  private readonly liveUpdates = inject(LiveUpdates);

  getAlerts(): Observable<NetworkAlert[]> {
    return this.http
      .get<BackendAlert[]>(this.baseUrl)
      .pipe(map((alerts) => alerts.map((alert) => this.toAlert(alert))));
  }

  watchNewAlerts(): Observable<NetworkAlert> {
    // Consulto /recent con un cursor "since" que avanza con la última alerta vista: cada alerta nueva o reconexión del
    // socket lo pide una vez, y sin socket en vivo sondeo cada pocos segundos.
    let since = new Date().toISOString();
    const polls = interval(LIVE_UPDATES_CONFIG.newAlertsPollIntervalMs).pipe(filter(() => !this.liveUpdates.isLive()));
    return merge(polls, this.liveUpdates.refreshesFor('alert.created')).pipe(
      // Si una consulta falla el cursor no avanza, así la siguiente lo vuelve a pedir y no se pierde nada.
      switchMap(() =>
        this.http.get<BackendAlert[]>(`${this.baseUrl}/recent`, { params: { since } }).pipe(catchError(() => EMPTY)),
      ),
      tap((alerts) => {
        if (alerts.length > 0) {
          since = alerts[alerts.length - 1].timestamp;
        }
      }),
      mergeMap((alerts) => from(alerts.map((alert) => this.toAlert(alert)))),
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
      messageKey: alert.message_key.startsWith(LEGACY_ALERT_KEY_PREFIX)
        ? `${ALERT_KEY_NAMESPACE}${alert.message_key}`
        : alert.message_key,
      messageParams: alert.message_params,
      timestamp: alert.timestamp,
      acknowledged: alert.acknowledged,
    };
  }
}
