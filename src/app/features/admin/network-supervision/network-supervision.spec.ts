import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MonitoredHousehold } from '../../../core/models/admin.model';
import { NetworkSupervisionRepository } from '../../../core/repositories/network-supervision.repository';
import { NetworkSupervision } from './network-supervision';

function household(overrides: Partial<MonitoredHousehold>): MonitoredHousehold {
  return {
    id: 'household-1',
    ownerName: 'Owner',
    label: 'owner@redsana.dev',
    status: 'good',
    securityScore: 80,
    securityScoreSource: 'real',
    securityScoreIsPartial: false,
    securityTechnicalMeasuredAt: null,
    lastActivity: '2026-10-05T12:00:00Z',
    ...overrides,
  };
}

async function renderCard(data: MonitoredHousehold): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter([]),
      { provide: NetworkSupervisionRepository, useValue: { getHouseholds: () => of([data]) } },
    ],
  });
  const fixture = TestBed.createComponent(NetworkSupervision);
  fixture.detectChanges();
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).querySelector('.score-block')!;
}

describe('NetworkSupervision security score', () => {
  it('etiqueta como parcial un puntaje sin análisis técnico, con el mismo texto que ve el usuario', async () => {
    const card = await renderCard(household({ securityScoreIsPartial: true }));

    expect(card.querySelector('.status-badge')?.textContent?.trim()).toBe('user.securityAssistant.score.partialLabel');
    expect(card.querySelector('.score-date')).toBeNull();
  });

  it('muestra la fecha de la medición reutilizada, sin etiqueta de parcial', async () => {
    const card = await renderCard(household({ securityTechnicalMeasuredAt: '2026-10-03T15:00:00Z' }));

    expect(card.querySelector('.status-badge')).toBeNull();
    expect(card.querySelector('.score-date')?.textContent).toContain('admin.networkSupervision.technicalMeasuredAt');
  });

  it('un puntaje completo no lleva etiqueta ni fecha', async () => {
    const card = await renderCard(household({}));

    expect(card.querySelector('.status-badge')).toBeNull();
    expect(card.querySelector('.score-date')).toBeNull();
  });
});
