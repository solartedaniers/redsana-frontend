/// <reference lib="webworker" />
import { LatencyProbeRequest, handleLatencyProbeRequest } from './latency-probe';

// Corre en un hilo aparte: si el hilo principal está ocupado (p. ej. pintando
// una lista grande), el tiempo de cada petición no incluye esa espera.
addEventListener('message', async ({ data }: MessageEvent<LatencyProbeRequest>) => {
  postMessage(await handleLatencyProbeRequest(data));
});
