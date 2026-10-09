import { LatencyProbeConfig, LatencyProbeRequest, LatencyProbeResponse, handleLatencyProbeRequest } from './latency-probe';
import { MainThreadLatencyProbeRunner, WorkerLatencyProbeRunner, createLatencyProbeRunner } from './latency-probe-runner';

const CONFIG: LatencyProbeConfig = { probeUrl: 'https://api.test/health', sampleCount: 3, sampleIntervalMs: 0, sampleTimeoutMs: 1000 };

/** Imita un Worker: responde como el hilo real y registra si se terminó. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<LatencyProbeResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  received: LatencyProbeRequest[] = [];
  constructor(readonly url: URL, readonly options: WorkerOptions) {
    FakeWorker.instances.push(this);
  }
  postMessage(request: LatencyProbeRequest): void {
    this.received.push(request);
    void handleLatencyProbeRequest(request).then((data) => this.onmessage?.({ data } as MessageEvent<LatencyProbeResponse>));
  }
  terminate(): void {
    this.terminated = true;
  }
}

describe('Medición web en Web Worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  });

  it('el Worker cronometra cada petición y marca como perdidas las fallidas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error('timeout')));

    const response = await handleLatencyProbeRequest({ type: 'measure', config: CONFIG });

    expect(response.type).toBe('samples');
    const samples = response.type === 'samples' ? response.samples : [];
    expect(samples).toHaveLength(3);
    expect(samples[0]).toBeGreaterThanOrEqual(0);
    expect(samples.slice(1)).toEqual([null, null]);
  });

  it('envía la configuración por mensaje, devuelve las muestras y termina el hilo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('Worker', FakeWorker);

    const samples = await new WorkerLatencyProbeRunner().run(CONFIG);

    const [worker] = FakeWorker.instances;
    expect(worker.received).toEqual([{ type: 'measure', config: CONFIG }]);
    expect(worker.options).toEqual({ type: 'module' });
    expect(samples).toHaveLength(3);
    expect(worker.terminated).toBe(true);
  });

  it('si el Worker falla, rechaza y también lo termina', async () => {
    class BrokenWorker extends FakeWorker {
      override postMessage(): void {
        this.onerror?.({ message: 'worker crashed' } as ErrorEvent);
      }
    }
    vi.stubGlobal('Worker', BrokenWorker);

    await expect(new WorkerLatencyProbeRunner().run(CONFIG)).rejects.toThrow('worker crashed');
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });

  it('usa el Worker si el entorno lo soporta y, si no, el mismo bucle en el hilo principal', () => {
    vi.stubGlobal('Worker', undefined);
    expect(createLatencyProbeRunner()).toBeInstanceOf(MainThreadLatencyProbeRunner);

    vi.stubGlobal('Worker', FakeWorker);
    expect(createLatencyProbeRunner()).toBeInstanceOf(WorkerLatencyProbeRunner);
  });
});
