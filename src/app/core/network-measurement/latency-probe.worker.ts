/// <reference lib="webworker" />
import { LatencyProbeRequest, handleLatencyProbeRequest } from './latency-probe';

// Corre en otro hilo para que una pausa del hilo principal no se cuele en el tiempo medido.
addEventListener('message', async ({ data }: MessageEvent<LatencyProbeRequest>) => {
  postMessage(await handleLatencyProbeRequest(data));
});
