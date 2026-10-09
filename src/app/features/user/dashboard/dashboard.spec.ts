import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Subject, of } from 'rxjs';
import { NetworkMetricSnapshot } from '../../../core/models/network.model';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { Dashboard } from './dashboard';

describe('Dashboard live snapshot', () => {
  it('deja de sondear al salir de la pantalla (no acumula intervals entre visitas)', () => {
    const snapshots = new Subject<NetworkMetricSnapshot>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: NetworkMetricsRepository,
          useValue: { watchSnapshot: () => snapshots, getHistory: () => of([]), getAnomalyStatus: () => NEVER },
        },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    expect(snapshots.observed).toBe(true);

    fixture.destroy();

    expect(snapshots.observed).toBe(false);
  });
});

describe('Dashboard sin mediciones', () => {
  function render(snapshot: NetworkMetricSnapshot) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: NetworkMetricsRepository,
          useValue: { watchSnapshot: () => of(snapshot), getHistory: () => of([]), getAnomalyStatus: () => NEVER },
        },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('con status unknown muestra "Aún no hay mediciones" y no ceros ni "en vivo"', () => {
    const element = render({ status: 'unknown', latencyMs: 0, jitterMs: 0, packetLossPercent: 0, updatedAt: new Date().toISOString() });

    expect(element.querySelector('app-measurement-empty-state')).not.toBeNull();
    expect(element.querySelector('app-metric-card')).toBeNull();
    expect(element.textContent).not.toContain('user.dashboard.live');
  });

  it('una medición real y reciente sí se marca "en vivo"; una vieja no', () => {
    const recent = render({ status: 'good', latencyMs: 20, jitterMs: 2, packetLossPercent: 0, updatedAt: new Date().toISOString() });
    expect(recent.querySelector('.metric-tile__detail')?.textContent?.trim()).toBe('user.dashboard.live');
    TestBed.resetTestingModule();

    const old = render({ status: 'good', latencyMs: 20, jitterMs: 2, packetLossPercent: 0, updatedAt: '2020-01-01T00:00:00Z' });
    expect(old.querySelector('.metric-tile__detail')?.textContent?.trim()).toBe('user.dashboard.lastMeasurement');
  });
});
