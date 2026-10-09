import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, interval, map, startWith, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnomalyDetectionStatus,
  NetworkMetricSample,
  NetworkMetricSnapshot,
  MeasurementSource,
  NetworkQualityMeasurement,
  NetworkStatus,
} from '../models/network.model';
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

interface BackendAnomalyStatus {
  status: 'calibrating' | 'active' | 'unknown_network';
  samples_collected: number;
  samples_required: number;
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
    // Sin streaming en el backend, reconsulto cada pocos segundos; switchMap evita acumular pedidos
    // y catchError por consulta salta ese tick en vez de matar el sondeo.
    return interval(LIVE_UPDATE_INTERVAL_MS).pipe(
      startWith(0),
      switchMap(() => this.getSnapshot(householdId).pipe(catchError(() => EMPTY)))
    );
  }

  getHistory(householdId?: string): Observable<NetworkMetricSample[]> {
    return this.http
      .get<BackendSample[]>(`${this.baseUrl}/history`, { params: this.ownerParams(householdId) })
      .pipe(map((samples) => samples.map((sample) => this.toSample(sample))));
  }

  record(
    measurement: NetworkQualityMeasurement,
    source: MeasurementSource,
    networkFingerprint: string | null
  ): Observable<NetworkMetricSnapshot> {
    const body = {
      latency_ms: measurement.latencyMs,
      jitter_ms: measurement.jitterMs,
      packet_loss_percent: measurement.packetLossPercent,
      source,
      network_fingerprint: networkFingerprint,
    };
    return this.http.post<BackendSnapshot>(this.baseUrl, body).pipe(map((snapshot) => this.toSnapshot(snapshot)));
  }

  getAnomalyStatus(householdId?: string): Observable<AnomalyDetectionStatus> {
    return this.http
      .get<BackendAnomalyStatus>(`${this.baseUrl}/anomaly-status`, { params: this.ownerParams(householdId) })
      .pipe(
        map((status) => ({
          status: status.status,
          samplesCollected: status.samples_collected,
          samplesRequired: status.samples_required,
        }))
      );
  }

  // user_id solo aplica cuando un admin revisa la red de otro hogar; si no, el backend usa el usuario actual.
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
