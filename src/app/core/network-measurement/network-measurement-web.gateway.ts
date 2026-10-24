import { Injectable } from '@angular/core';
import { BACKEND_HEALTH_URL } from '../backend/backend-endpoints';
import { aggregateLatencySamples } from '../domain/network-quality.calculator';
import { NetworkQualityMeasurement } from '../models/network.model';
import { LatencyProbeConfig } from './latency-probe';
import { LatencyProbeRunner, createLatencyProbeRunner } from './latency-probe-runner';
import { NetworkMeasurementGateway } from './network-measurement.gateway';

// Mismos valores que ping.rs para que una medición web y una nativa sean comparables.
const SAMPLE_COUNT = 5;
const SAMPLE_INTERVAL_MS = 200;
const SAMPLE_TIMEOUT_MS = 1000;

// El navegador no puede enviar ICMP: mide HTTP al backend, que incluye lo que tarda el servidor (más que un ping).
@Injectable()
export class NetworkMeasurementWebGateway extends NetworkMeasurementGateway {
  readonly source = 'web';
  // Uso el Worker si existe; si no, el mismo bucle en el hilo principal.
  private readonly runner: LatencyProbeRunner = createLatencyProbeRunner();
  private readonly config: LatencyProbeConfig = {
    probeUrl: BACKEND_HEALTH_URL,
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
