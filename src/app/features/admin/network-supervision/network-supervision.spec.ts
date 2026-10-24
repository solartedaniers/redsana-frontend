import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MonitoredHousehold } from '../../../core/models/admin.model';
import { NetworkSupervisionRepository } from '../../../core/repositories/network-supervision.repository';
import { FALLBACK_SECURITY_SCORE_CONFIG } from '../../../core/security-score-config/security-score-config.config';
import { SecurityScoreConfigService } from '../../../core/security-score-config/security-score-config.service';
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

async function renderPage(
  data: MonitoredHousehold,
  scoreConfig = FALLBACK_SECURITY_SCORE_CONFIG,
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter([]),
      { provide: NetworkSupervisionRepository, useValue: { getHouseholds: () => of([data]) } },
      { provide: SecurityScoreConfigService, useValue: { config: signal(scoreConfig) } },
    ],
  });
  const fixture = TestBed.createComponent(NetworkSupervision);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

async function renderCard(data: MonitoredHousehold): Promise<HTMLElement> {
  return (await renderPage(data)).querySelector('.score-block')!;
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

  it('colorea la tarjeta con los rangos que publica el backend', async () => {
    const fallback = await renderPage(household({ securityScore: 80 }));
    expect(fallback.querySelector('.household-card')!.getAttribute('data-band')).toBe('good');

    TestBed.resetTestingModule();
    const stricter = await renderPage(household({ securityScore: 80 }), {
      ...FALLBACK_SECURITY_SCORE_CONFIG,
      goodMin: 90,
    });
    expect(stricter.querySelector('.household-card')!.getAttribute('data-band')).toBe('warning');
  });
});
