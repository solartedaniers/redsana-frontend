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
