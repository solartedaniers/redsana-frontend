/** Parámetros de una medición web: cuántas peticiones, cada cuánto y con qué timeout. */
export interface LatencyProbeConfig {
  probeUrl: string;
  sampleCount: number;
  sampleIntervalMs: number;
  sampleTimeoutMs: number;
}

/** null es una muestra perdida (timeout, red caída o respuesta fallida). */
export type LatencySample = number | null;

export interface LatencyProbeRequest {
  type: 'measure';
  config: LatencyProbeConfig;
}

export type LatencyProbeResponse = { type: 'samples'; samples: LatencySample[] } | { type: 'failed'; reason: string };

/** Bucle de sondeo que comparten el Worker y el respaldo; cada muestra es una petición HTTP cronometrada. */
export async function runLatencyProbes(config: LatencyProbeConfig): Promise<LatencySample[]> {
  const samples: LatencySample[] = [];
  for (let i = 0; i < config.sampleCount; i++) {
    samples.push(await probeOnce(config));
    await new Promise((resolve) => setTimeout(resolve, config.sampleIntervalMs));
  }
  return samples;
}

async function probeOnce(config: LatencyProbeConfig): Promise<LatencySample> {
  const startedAt = performance.now();
  try {
    // no-store: una respuesta de caché daría ~0 ms falsos.
    const response = await fetch(config.probeUrl, { cache: 'no-store', signal: AbortSignal.timeout(config.sampleTimeoutMs) });
    return response.ok ? performance.now() - startedAt : null;
  } catch {
    return null;
  }
}

/** Lógica del Worker separada del `self` global para poder probarla sin un Worker real. */
export async function handleLatencyProbeRequest(request: LatencyProbeRequest): Promise<LatencyProbeResponse> {
  try {
    return { type: 'samples', samples: await runLatencyProbes(request.config) };
  } catch (error) {
    return { type: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}
