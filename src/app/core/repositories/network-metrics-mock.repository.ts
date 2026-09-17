import { Injectable } from '@angular/core';
import { Observable, delay, interval, map, of, startWith } from 'rxjs';
import { NetworkMetricsRepository } from './network-metrics.repository';
import { NetworkMetricSample, NetworkMetricSnapshot } from '../models/network.model';
import { computeNetworkStatus } from '../domain/network-status.calculator';

const SIMULATED_LATENCY_MS = 300;
const LIVE_UPDATE_INTERVAL_MS = 4000;
const HISTORY_POINTS = 24;
const HISTORY_STEP_MINUTES = 5;

@Injectable()
export class MockNetworkMetricsRepository extends NetworkMetricsRepository {
  getSnapshot(): Observable<NetworkMetricSnapshot> {
    return of(this.generateSnapshot()).pipe(delay(SIMULATED_LATENCY_MS));
  }

  watchSnapshot(): Observable<NetworkMetricSnapshot> {
    return interval(LIVE_UPDATE_INTERVAL_MS).pipe(
      startWith(0),
      map(() => this.generateSnapshot())
    );
  }

  getHistory(): Observable<NetworkMetricSample[]> {
    const now = Date.now();
    const samples: NetworkMetricSample[] = Array.from({ length: HISTORY_POINTS }, (_, index) => ({
      timestamp: new Date(
        now - (HISTORY_POINTS - index) * HISTORY_STEP_MINUTES * 60 * 1000
      ).toISOString(),
      latencyMs: this.randomInRange(18, 95),
    }));
    return of(samples).pipe(delay(SIMULATED_LATENCY_MS));
  }

  private generateSnapshot(): NetworkMetricSnapshot {
    const latencyMs = this.randomInRange(15, 120);
    const jitterMs = this.randomInRange(1, 20);
    const packetLossPercent = Number((Math.random() * 3).toFixed(2));
    return {
      status: computeNetworkStatus(latencyMs, packetLossPercent),
      latencyMs,
      jitterMs,
      packetLossPercent,
      updatedAt: new Date().toISOString(),
    };
  }

  private randomInRange(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min));
  }
}
