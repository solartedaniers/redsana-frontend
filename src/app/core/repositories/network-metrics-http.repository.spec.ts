import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NetworkMetricsHttpRepository } from './network-metrics-http.repository';

describe('NetworkMetricsHttpRepository.getHistory', () => {
  function history(body: object[]) {
    TestBed.configureTestingModule({
      providers: [NetworkMetricsHttpRepository, provideHttpClient(), provideHttpClientTesting()],
    });
    const samples: unknown[] = [];
    TestBed.inject(NetworkMetricsHttpRepository)
      .getHistory()
      .subscribe((received) => samples.push(...received));
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/history'))
      .flush(body);
    return samples;
  }

  it('trae la pérdida de paquetes de cada muestra', () => {
    expect(history([{ timestamp: 't', latency_ms: 50, packet_loss_percent: 3 }])).toEqual([
      { timestamp: 't', latencyMs: 50, packetLossPercent: 3 },
    ]);
  });

  it('con un backend anterior, sin pérdida, la deja sin definir', () => {
    expect(history([{ timestamp: 't', latency_ms: 50 }])).toEqual([
      { timestamp: 't', latencyMs: 50, packetLossPercent: undefined },
    ]);
  });
});

describe('NetworkMetricsHttpRepository.watchSnapshot', () => {
  afterEach(() => vi.useRealTimers());

  it('un fallo puntual del backend salta ese tick pero el sondeo sigue vivo', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [NetworkMetricsHttpRepository, provideHttpClient(), provideHttpClientTesting()],
    });
    const repository = TestBed.inject(NetworkMetricsHttpRepository);
    const http = TestBed.inject(HttpTestingController);
    const received: number[] = [];
    let failed = false;

    const subscription = repository.watchSnapshot().subscribe({
      next: (snapshot) => received.push(snapshot.latencyMs),
      error: () => (failed = true),
    });

    http.expectOne((req) => req.url.endsWith('/latest')).flush('down', { status: 503, statusText: 'Unavailable' });
    vi.runOnlyPendingTimers();
    http
      .expectOne((req) => req.url.endsWith('/latest'))
      .flush({ latency_ms: 12, jitter_ms: 1, packet_loss_percent: 0, updated_at: '2026-10-07T00:00:00Z' });

    expect(failed).toBe(false);
    expect(received).toEqual([12]);
    subscription.unsubscribe();
  });
});

describe('NetworkMetricsHttpRepository.record', () => {
  function sentBody(recordedAt?: string, sentAt?: string) {
    TestBed.configureTestingModule({
      providers: [NetworkMetricsHttpRepository, provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(NetworkMetricsHttpRepository)
      .record({ latencyMs: 20, jitterMs: 1, packetLossPercent: 0 }, 'native', null, recordedAt, sentAt)
      .subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne((req) => req.method === 'POST');
    // HttpClient serializa con JSON.stringify: un campo undefined no viaja.
    return JSON.parse(JSON.stringify(request.request.body)) as Record<string, unknown>;
  }

  it('lo que sale de la cola lleva su hora original y la hora de envío', () => {
    const body = sentBody('2026-10-24T12:00:00.000Z', '2026-10-24T12:05:00.000Z');
    expect(body['recorded_at']).toBe('2026-10-24T12:00:00.000Z');
    expect(body['sent_at']).toBe('2026-10-24T12:05:00.000Z');
  });

  it('sin hora no manda el campo y el backend usa la suya, como antes', () => {
    const body = sentBody();
    expect(body).not.toHaveProperty('recorded_at');
    expect(body).not.toHaveProperty('sent_at');
  });
});

describe('NetworkMetricsHttpRepository: latencia al router y diagnóstico', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [NetworkMetricsHttpRepository, provideHttpClient(), provideHttpClientTesting()],
    });
    return { repository: TestBed.inject(NetworkMetricsHttpRepository), http: TestBed.inject(HttpTestingController) };
  }

  it('el escritorio manda la latencia al router; la web no manda el campo', () => {
    const { repository, http } = setup();
    repository
      .record({ latencyMs: 20, jitterMs: 1, packetLossPercent: 0, gatewayLatencyMs: 3.5 }, 'native', null)
      .subscribe();
    repository.record({ latencyMs: 200, jitterMs: 9, packetLossPercent: 0 }, 'web', null).subscribe();

    const [desktop, web] = http
      .match((req) => req.method === 'POST')
      .map((req) => JSON.parse(JSON.stringify(req.request.body)));

    expect(desktop['gateway_latency_ms']).toBe(3.5);
    expect(web).not.toHaveProperty('gateway_latency_ms');
  });

  it('lee el diagnóstico de /latest y, con un backend anterior, lo deja en null', () => {
    const { repository, http } = setup();
    const received: unknown[] = [];
    repository.getSnapshot().subscribe((snapshot) => received.push(snapshot));
    repository.getSnapshot().subscribe((snapshot) => received.push(snapshot));
    const [withDiagnosis, older] = http.match((req) => req.url.endsWith('/latest'));
    const base = { status: 'critical', latency_ms: 300, jitter_ms: 2, packet_loss_percent: 0, updated_at: 't' };
    withDiagnosis.flush({ ...base, gateway_latency_ms: 4, diagnosis: 'provider', possible_busy_device: false });
    older.flush(base);

    expect(received).toMatchObject([
      { gatewayLatencyMs: 4, diagnosis: 'provider', possibleBusyDevice: false },
      { gatewayLatencyMs: null, diagnosis: null, possibleBusyDevice: null },
    ]);
  });
});
