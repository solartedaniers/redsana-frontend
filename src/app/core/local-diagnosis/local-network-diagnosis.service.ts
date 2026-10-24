import { Injectable, computed, inject, signal } from '@angular/core';
import { diagnoseNetwork } from '../domain/network-diagnosis';
import { NetworkDiagnosis, NetworkQualityMeasurement } from '../models/network.model';
import { NetworkThresholdsService } from '../network-thresholds/network-thresholds.service';

export interface LocalDiagnosis {
  readonly diagnosis: NetworkDiagnosis;
  readonly gatewayLatencyMs: number | null;
  /** Hora en que se tomó la medición diagnosticada. */
  readonly recordedAt: string;
}

interface LocalMeasurement {
  readonly recordedAt: string;
  readonly measurement: NetworkQualityMeasurement;
}

const ROUTER_REPLY_STORAGE_KEY = 'redsana-last-router-reply';
const MS_PER_MINUTE = 60_000;

/**
 * Solo escritorio: guarda la última medición del equipo y cuándo respondió el router por última vez (sobrevive a
 * reiniciar la app), y la diagnostica con la misma regla que el backend. El dashboard la usa cuando el servidor no
 * responde, que es justo cuando se cae internet.
 */
@Injectable({ providedIn: 'root' })
export class LocalNetworkDiagnosisService {
  private readonly thresholds = inject(NetworkThresholdsService);
  private readonly latest = signal<LocalMeasurement | null>(null);
  private readonly lastRouterReplyAt = signal<string | null>(readStoredReply());

  readonly current = computed<LocalDiagnosis | null>(() => {
    const latest = this.latest();
    if (!latest) {
      return null;
    }
    const gatewayLatencyMs = latest.measurement.gatewayLatencyMs ?? null;
    const lastReply = this.lastRouterReplyAt();
    const diagnosis = diagnoseNetwork(
      {
        latencyMs: latest.measurement.latencyMs,
        packetLossPercent: latest.measurement.packetLossPercent,
        gatewayLatencyMs,
        // Desde la hora de la medición, con el mismo reloj: igual que el backend.
        minutesSinceRouterReply: lastReply
          ? (Date.parse(latest.recordedAt) - Date.parse(lastReply)) / MS_PER_MINUTE
          : null,
      },
      this.thresholds.thresholds(),
      this.thresholds.routerLimits(),
    );
    return diagnosis ? { diagnosis, gatewayLatencyMs, recordedAt: latest.recordedAt } : null;
  });

  record(recordedAt: string, measurement: NetworkQualityMeasurement): void {
    // Primero la respuesta del router: una medición donde respondió cuenta como "respondió hace 0 minutos".
    if (measurement.gatewayLatencyMs != null) {
      this.lastRouterReplyAt.set(recordedAt);
      try {
        localStorage.setItem(ROUTER_REPLY_STORAGE_KEY, recordedAt);
      } catch (error) {
        console.warn('No se pudo guardar la última respuesta del router', error);
      }
    }
    this.latest.set({ recordedAt, measurement });
  }
}

function readStoredReply(): string | null {
  try {
    const stored = localStorage.getItem(ROUTER_REPLY_STORAGE_KEY);
    return stored && !Number.isNaN(Date.parse(stored)) ? stored : null;
  } catch {
    return null;
  }
}
