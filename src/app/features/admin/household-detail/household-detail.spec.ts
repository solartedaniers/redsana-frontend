import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MonitoredHousehold } from '../../../core/models/admin.model';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { NetworkSupervisionRepository } from '../../../core/repositories/network-supervision.repository';
import { HouseholdDetail } from './household-detail';

const household = (source: MonitoredHousehold['securityScoreSource']): MonitoredHousehold => ({
  id: 'h1',
  ownerName: 'Owner',
  label: 'owner@redsana.dev',
  status: 'good',
  securityScore: 72,
  securityScoreSource: source,
  securityScoreIsPartial: false,
  securityTechnicalMeasuredAt: null,
  lastActivity: '2026-10-05T12:00:00Z',
});

function render(source: MonitoredHousehold['securityScoreSource']): HTMLElement {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'h1' }) } } },
      { provide: NetworkSupervisionRepository, useValue: { getHouseholds: () => of([household(source)]) } },
      {
        provide: NetworkMetricsRepository,
        useValue: {
          getSnapshot: () => of({ status: 'unknown', latencyMs: 0, jitterMs: 0, packetLossPercent: 0, updatedAt: '2026-10-05T12:00:00Z' }),
          getHistory: () => of([]),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(HouseholdDetail);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('HouseholdDetail origen del puntaje', () => {
  for (const source of ['real', 'estimated'] as const) {
    it(`indica que el puntaje es ${source}`, () => {
      const label = render(source).querySelector('.score-source');
      expect(label?.getAttribute('data-source')).toBe(source);
      expect(label?.textContent?.trim()).toBe(`admin.networkSupervision.scoreSource.${source}`);
    });
  }
});
