import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { aggregateLatencySamples } from '../domain/network-quality.calculator';
import { NetworkQualityMeasurement } from '../models/network.model';
import { NetworkMeasurementGateway } from './network-measurement.gateway';

// Mismos valores que QUALITY_SAMPLE_COUNT / QUALITY_SAMPLE_INTERVAL / PING_TIMEOUT
// de ping.rs, para que una medición web y una nativa sean comparables.
const SAMPLE_COUNT = 5;
const SAMPLE_INTERVAL_MS = 200;
const SAMPLE_TIMEOUT_MS = 1000;

/**
 * El navegador no puede enviar ICMP, así que cada muestra es una petición HTTP
 * cronometrada contra el backend. Limitación conocida: el tiempo medido
 * incluye la red y también lo que tarda el servidor en responder (TLS, cola,
 * proceso), por eso la latencia web sale más alta que el ping nativo.
 */
@Injectable()
export class NetworkMeasurementWebGateway extends NetworkMeasurementGateway {
  readonly source = 'web';
  private readonly probeUrl = `${environment.apiBaseUrl}/api/health`;

  async measure(): Promise<NetworkQualityMeasurement> {
    const latenciesMs: number[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const latencyMs = await this.probeOnce();
      if (latencyMs !== null) {
        latenciesMs.push(latencyMs);
      }
      await new Promise((resolve) => setTimeout(resolve, SAMPLE_INTERVAL_MS));
    }
    return aggregateLatencySamples(latenciesMs, SAMPLE_COUNT);
  }

  /** null = muestra perdida (timeout, red caída o respuesta no exitosa). */
  private async probeOnce(): Promise<number | null> {
    const startedAt = performance.now();
    try {
      // no-store: una respuesta servida desde caché (HTTP o service worker) daría ~0 ms falsos.
      const response = await fetch(this.probeUrl, { cache: 'no-store', signal: AbortSignal.timeout(SAMPLE_TIMEOUT_MS) });
      return response.ok ? performance.now() - startedAt : null;
    } catch {
      return null;
    }
  }
}
