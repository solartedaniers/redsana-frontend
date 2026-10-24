import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FALLBACK_SECURITY_SCORE_CONFIG } from '../../../core/security-score-config/security-score-config.config';
import { SecurityScoreConfigService } from '../../../core/security-score-config/security-score-config.service';
import { ScoreGauge } from './score-gauge';

function render(score: number, config = FALLBACK_SECURITY_SCORE_CONFIG): HTMLElement {
  TestBed.configureTestingModule({
    providers: [{ provide: SecurityScoreConfigService, useValue: { config: signal(config) } }],
  });
  const fixture = TestBed.createComponent(ScoreGauge);
  fixture.componentRef.setInput('score', score);
  fixture.componentRef.setInput('questionnaireScore', 100);
  fixture.componentRef.setInput('technicalScore', 50);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ScoreGauge', () => {
  it('con el respaldo divide el arco 30/70 y pinta 80 como bueno', () => {
    const gauge = render(80);

    expect(gauge.querySelector('.score-gauge')!.getAttribute('data-band')).toBe('good');
    expect(gauge.querySelector('.segment--questionnaire')!.getAttribute('stroke-dasharray')).toBe('30 100');
    expect(gauge.querySelector('.segment--technical')!.getAttribute('stroke-dasharray')).toBe('0 30 35 100');
  });

  it('sigue los rangos y pesos que publica el backend', () => {
    const config = { goodMin: 90, warningMin: 60, questionnaireWeightPercent: 40, technicalWeightPercent: 60 };
    const gauge = render(80, config);

    expect(gauge.querySelector('.score-gauge')!.getAttribute('data-band')).toBe('warning');
    expect(gauge.querySelector('.segment--questionnaire')!.getAttribute('stroke-dasharray')).toBe('40 100');
    expect(gauge.querySelector('.segment--technical')!.getAttribute('stroke-dasharray')).toBe('0 40 30 100');
    expect(gauge.querySelector('.tick--split')!.getAttribute('style')).toContain('72deg');
  });
});
