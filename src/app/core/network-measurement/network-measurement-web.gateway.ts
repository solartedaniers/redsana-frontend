import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { aggregateLatencySamples } from '../domain/network-quality.calculator';
import { NetworkQualityMeasurement } from '../models/network.model';
import { LatencyProbeConfig } from './latency-probe';
import { LatencyProbeRunner, createLatencyProbeRunner } from './latency-probe-runner';
import { NetworkMeasurementGateway } from './network-measurement.gateway';

// Mismos valores que QUALITY_SAMPLE_COUNT / QUALITY_SAMPLE_INTERVAL / PING_TIMEOUT
// de ping.rs, para que una medición web y una nativa sean comparables.
const SAMPLE_COUNT = 5;
const SAMPLE_INTERVAL_MS = 200;
const SAMPLE_TIMEOUT_MS = 1000;

/**
 * El navegador no puede enviar ICMP, así que cada muestra es una petición HTTP
 * cronometrada contra el backend, hecha en un Web Worker (ver latency-probe.worker.ts).
 * Limitación conocida: el tiempo medido incluye la red y también lo que tarda
 * el servidor en responder (TLS, cola, proceso), por eso la latencia web sale
 * más alta que el ping nativo.
 */
@Injectable()
export class NetworkMeasurementWebGateway extends NetworkMeasurementGateway {
  readonly source = 'web';
  // Worker si el entorno lo soporta; si no, el mismo bucle en el hilo principal.
  private readonly runner: LatencyProbeRunner = createLatencyProbeRunner();
  private readonly config: LatencyProbeConfig = {
    probeUrl: `${environment.apiBaseUrl}/api/health`,
    sampleCount: SAMPLE_COUNT,
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    sampleTimeoutMs: SAMPLE_TIMEOUT_MS,
  };

  async measure(): Promise<NetworkQualityMeasurement> {
    const samples = await this.runner.run(this.config);
    const received = samples.filter((sample): sample is number => sample !== null);
    return aggregateLatencySamples(received, SAMPLE_COUNT);
  }
}
