import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NetworkAlert } from '../models/alert.model';
import { AlertsHttpRepository } from './alerts-http.repository';
import { LiveUpdates } from '../realtime/live-updates';
import { LIVE_UPDATES_CONFIG } from '../realtime/live-updates.config';

describe('AlertsHttpRepository', () => {
  it('pide las alertas recientes a /api/alerts/recent con el cursor since', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [AlertsHttpRepository, provideHttpClient(), provideHttpClientTesting()],
    });
    const subscription = TestBed.inject(AlertsHttpRepository).watchNewAlerts().subscribe();

    vi.runOnlyPendingTimers();
    const request = TestBed.inject(HttpTestingController).expectOne((req) => req.url.endsWith('/api/alerts/recent'));

    expect(request.request.params.has('since')).toBe(true);
    request.flush([]);
    subscription.unsubscribe();
    vi.useRealTimers();
  });

  it('completa la clave de las alertas viejas para que se traduzcan en vez de mostrarse crudas', () => {
    TestBed.configureTestingModule({
      providers: [AlertsHttpRepository, provideHttpClient(), provideHttpClientTesting()],
    });
    const repository = TestBed.inject(AlertsHttpRepository);
    let alerts: NetworkAlert[] = [];

    repository.getAlerts().subscribe((result) => (alerts = result));
    const base = { severity: 'critical', message_params: null, timestamp: '2026-10-07T00:00:00Z', acknowledged: false };
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/api/alerts'))
      .flush([
        { ...base, id: 'old', type: 'outage', message_key: 'alertsCenter.messages.briefOutage' },
        {
          ...base,
          id: 'new',
          type: 'untrusted_device',
          message_key: 'user.alertsCenter.messages.untrustedDeviceOnline',
        },
      ]);

    expect(alerts.map((alert) => alert.messageKey)).toEqual([
      'user.alertsCenter.messages.briefOutage',
      'user.alertsCenter.messages.untrustedDeviceOnline',
    ]);
  });
});

describe('AlertsHttpRepository.watchNewAlerts con el socket', () => {
  afterEach(() => vi.useRealTimers());

  it('en vivo no sondea y pide /recent con cada alerta propia y al reconectar; al caerse vuelve a sondear', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [AlertsHttpRepository, provideHttpClient(), provideHttpClientTesting()],
    });
    const live = TestBed.inject(LiveUpdates);
    const http = TestBed.inject(HttpTestingController);
    const recent = (req: { url: string }) => req.url.endsWith('/api/alerts/recent');
    const subscription = TestBed.inject(AlertsHttpRepository).watchNewAlerts().subscribe();

    live.setLive(true);
    vi.advanceTimersByTime(LIVE_UPDATES_CONFIG.newAlertsPollIntervalMs * 3);
    http.expectNone(recent);
    live.publish({ type: 'alert.created', owner_id: 'me', data: {}, at: 't' });
    http.expectOne(recent).flush([]);
    live.resync();
    http.expectOne(recent).flush([]);

    live.setLive(false);
    vi.advanceTimersByTime(LIVE_UPDATES_CONFIG.newAlertsPollIntervalMs);
    http.expectOne(recent).flush([]);
    subscription.unsubscribe();
  });
});
