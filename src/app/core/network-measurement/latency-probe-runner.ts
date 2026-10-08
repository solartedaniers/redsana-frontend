import { LatencyProbeConfig, LatencyProbeRequest, LatencyProbeResponse, LatencySample, runLatencyProbes } from './latency-probe';

/** Dónde se ejecutan los sondeos de la medición web. */
export interface LatencyProbeRunner {
  run(config: LatencyProbeConfig): Promise<LatencySample[]>;
}

/** Un Worker por medición (una por minuto): se crea, mide y se termina; no queda ningún hilo vivo entre mediciones. */
export class WorkerLatencyProbeRunner implements LatencyProbeRunner {
  run(config: LatencyProbeConfig): Promise<LatencySample[]> {
    const worker = new Worker(new URL('./latency-probe.worker', import.meta.url), { type: 'module' });
    return new Promise<LatencySample[]>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<LatencyProbeResponse>) =>
        data.type === 'samples' ? resolve(data.samples) : reject(new Error(data.reason));
      worker.onerror = (event) => reject(new Error(event.message));
      const request: LatencyProbeRequest = { type: 'measure', config };
      worker.postMessage(request);
    }).finally(() => worker.terminate());
  }
}

/** Respaldo sin Worker (entornos sin la API, p. ej. pruebas): mismo bucle, en el hilo principal. */
export class MainThreadLatencyProbeRunner implements LatencyProbeRunner {
  run(config: LatencyProbeConfig): Promise<LatencySample[]> {
    return runLatencyProbes(config);
  }
}

export function createLatencyProbeRunner(): LatencyProbeRunner {
  return typeof Worker === 'undefined' ? new MainThreadLatencyProbeRunner() : new WorkerLatencyProbeRunner();
}
