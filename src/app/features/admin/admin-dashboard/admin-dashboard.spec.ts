import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PlatformMetrics } from '../../../core/models/admin.model';
import { AdminMetricsRepository } from '../../../core/repositories/admin-metrics.repository';
import { AdminDashboard } from './admin-dashboard';

function render(metrics: PlatformMetrics): HTMLElement {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), { provide: AdminMetricsRepository, useValue: { getPlatformMetrics: () => of(metrics) } }],
  });
  const fixture = TestBed.createComponent(AdminDashboard);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const base: PlatformMetrics = { totalUsers: 4, monitoredHouseholds: 3, activeAlerts: 0, averageSecurityScore: 0, realScoredHouseholds: 0, unevaluatedHouseholds: 3 };
const heroValue = (element: HTMLElement) => element.querySelector('.metrics-grid__hero .value')?.textContent?.replace(/\s+/g, '');
const note = (element: HTMLElement) => element.querySelector('.metrics-grid__note')?.textContent?.trim();

describe('AdminDashboard promedio de seguridad', () => {
  it('solo con puntajes reales muestra el promedio y ningún aviso de sin evaluar', () => {
    const element = render({ ...base, averageSecurityScore: 82, realScoredHouseholds: 3, unevaluatedHouseholds: 0 });
    expect(heroValue(element)).toBe('82%');
    expect(note(element)).toBeUndefined();
  });

  it('con reales y sin evaluar muestra el promedio real y cuántos faltan', () => {
    const element = render({ ...base, averageSecurityScore: 70, realScoredHouseholds: 1, unevaluatedHouseholds: 2 });
    expect(heroValue(element)).toBe('70%');
    expect(note(element)).toBe('admin.dashboard.unevaluatedHouseholds');
  });

  it('sin ningún puntaje real muestra "Sin datos", nunca 0', () => {
    const element = render(base);
    expect(heroValue(element)).toBe('admin.dashboard.noData');
    expect(note(element)).toBe('admin.dashboard.unevaluatedHouseholds');
  });

  it('sin hogares muestra "Sin datos" y ningún aviso', () => {
    const element = render({ ...base, monitoredHouseholds: 0, realScoredHouseholds: 0, unevaluatedHouseholds: 0 });
    expect(heroValue(element)).toBe('admin.dashboard.noData');
    expect(note(element)).toBeUndefined();
  });
});
