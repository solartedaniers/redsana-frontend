import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MetricCard } from './metric-card';

describe('MetricCard', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient()] }));

  function renderValue(value: string | number): string {
    const fixture = TestBed.createComponent(MetricCard);
    fixture.componentRef.setInput('labelKey', 'user.dashboard.latency');
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.value')!.textContent!.trim();
  }

  it('redondea las mediciones crudas a un decimal', () => {
    expect(renderValue(3.67999998927116)).toBe('3.7');
    expect(renderValue(0.450000002980232)).toBe('0.5');
  });

  it('deja los enteros y los textos tal cual', () => {
    expect(renderValue(12)).toBe('12');
    expect(renderValue('N/A')).toBe('N/A');
  });
});
