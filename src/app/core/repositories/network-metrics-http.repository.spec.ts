import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NetworkMetricsHttpRepository } from './network-metrics-http.repository';

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
