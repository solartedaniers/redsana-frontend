import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NEVER, of, throwError } from 'rxjs';
import { AlertsRepository } from '../../../core/repositories/alerts.repository';
import { AlertsCenter } from './alerts-center';

function render(getAlerts: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideNoopAnimations(),
      { provide: AlertsRepository, useValue: { getAlerts, watchNewAlerts: () => NEVER, acknowledge: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(AlertsCenter);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AlertsCenter', () => {
  it('si la consulta falla no afirma que no hay alertas y ofrece reintentar', () => {
    const getAlerts = vi.fn().mockReturnValueOnce(throwError(() => new Error('offline'))).mockReturnValueOnce(of([]));
    const { fixture, element } = render(getAlerts);

    expect(element.querySelector('.alerts-error')?.textContent).toContain('user.alertsCenter.loadError');
    expect(element.textContent).not.toContain('user.alertsCenter.empty');
    expect(element.querySelector('app-alerts-summary')).toBeNull();

    element.querySelector<HTMLButtonElement>('.alerts-error button')!.click();
    fixture.detectChanges();

    expect(getAlerts).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.alerts-empty')?.textContent?.trim()).toBe('user.alertsCenter.empty');
    expect(element.querySelector('app-alerts-summary')).not.toBeNull();
  });
});
