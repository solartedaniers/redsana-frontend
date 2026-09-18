import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, interval, map, startWith, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkMetricSample, NetworkMetricSnapshot, NetworkStatus } from '../models/network.model';
import { NetworkMetricsRepository } from './network-metrics.repository';

const LIVE_UPDATE_INTERVAL_MS = 4000;

interface BackendSnapshot {
  status: NetworkStatus;
  latency_ms: number;
  jitter_ms: number;
  packet_loss_percent: number;
  updated_at: string;
}

interface BackendSample {
  timestamp: string;
  latency_ms: number;
}

@Injectable()
export class NetworkMetricsHttpRepository extends NetworkMetricsRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/network-metrics`;

  getSnapshot(householdId?: string): Observable<NetworkMetricSnapshot> {
    return this.http
      .get<BackendSnapshot>(`${this.baseUrl}/latest`, { params: this.ownerParams(householdId) })
      .pipe(map((snapshot) => this.toSnapshot(snapshot)));
  }

  watchSnapshot(householdId?: string): Observable<NetworkMetricSnapshot> {
    // El backend aun no expone push/streaming: se simula "en vivo" reconsultando
    // el ultimo snapshot a intervalos, con switchMap para no acumular pedidos.
    return interval(LIVE_UPDATE_INTERVAL_MS).pipe(
      startWith(0),
      switchMap(() => this.getSnapshot(householdId))
    );
  }

  getHistory(householdId?: string): Observable<NetworkMetricSample[]> {
    return this.http
      .get<BackendSample[]>(`${this.baseUrl}/history`, { params: this.ownerParams(householdId) })
      .pipe(map((samples) => samples.map((sample) => this.toSample(sample))));
  }

  // El backend por defecto scopea al usuario autenticado; user_id solo aplica
  // cuando un admin inspecciona la red de otro hogar (household-detail).
  private ownerParams(householdId?: string): Record<string, string> {
    return householdId ? { user_id: householdId } : {};
  }

  private toSnapshot(snapshot: BackendSnapshot): NetworkMetricSnapshot {
    return {
      status: snapshot.status,
      latencyMs: snapshot.latency_ms,
      jitterMs: snapshot.jitter_ms,
      packetLossPercent: snapshot.packet_loss_percent,
      updatedAt: snapshot.updated_at,
    };
  }

  private toSample(sample: BackendSample): NetworkMetricSample {
    return { timestamp: sample.timestamp, latencyMs: sample.latency_ms };
  }
}
