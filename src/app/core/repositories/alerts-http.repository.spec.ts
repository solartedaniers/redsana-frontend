import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NetworkAlert } from '../models/alert.model';
import { AlertsHttpRepository } from './alerts-http.repository';

describe('AlertsHttpRepository', () => {
  it('completa la clave de las alertas viejas para que se traduzcan en vez de mostrarse crudas', () => {
    TestBed.configureTestingModule({ providers: [AlertsHttpRepository, provideHttpClient(), provideHttpClientTesting()] });
    const repository = TestBed.inject(AlertsHttpRepository);
    let alerts: NetworkAlert[] = [];

    repository.getAlerts().subscribe((result) => (alerts = result));
    const base = { severity: 'critical', message_params: null, timestamp: '2026-10-07T00:00:00Z', acknowledged: false };
    TestBed.inject(HttpTestingController)
      .expectOne(() => true)
      .flush([
        { ...base, id: 'old', type: 'outage', message_key: 'alertsCenter.messages.briefOutage' },
        { ...base, id: 'new', type: 'untrusted_device', message_key: 'user.alertsCenter.messages.untrustedDeviceOnline' },
      ]);

    expect(alerts.map((alert) => alert.messageKey)).toEqual([
      'user.alertsCenter.messages.briefOutage',
      'user.alertsCenter.messages.untrustedDeviceOnline',
    ]);
  });
});
