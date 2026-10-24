import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NetworkThresholdsService } from '../../../core/network-thresholds/network-thresholds.service';
import { HistoryChart } from './history-chart';

const SAMPLES = [
  { timestamp: '2026-01-01T00:00:00Z', latencyMs: 20, packetLossPercent: 0 },
  { timestamp: '2026-01-01T00:01:00Z', latencyMs: 50, packetLossPercent: 3 },
];

// El traductor de prueba deja ver la clave y los parámetros con que se pidió cada texto.
const translate = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

function legendItems(
  thresholds = {
    latencyWarningMs: 100,
    latencyCriticalMs: 250,
    packetLossWarningPercent: 2,
    packetLossCriticalPercent: 9,
  },
) {
  TestBed.configureTestingModule({
    providers: [
      { provide: I18nService, useValue: { translate, language: signal('es') } },
      { provide: NetworkThresholdsService, useValue: { thresholds: signal(thresholds) } },
    ],
  });
  const fixture = TestBed.createComponent(HistoryChart);
  fixture.componentRef.setInput('samples', SAMPLES);
  fixture.detectChanges();
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLIElement>('.ecg__legend li')];
}

describe('HistoryChart legend', () => {
  it('muestra frases simples, sin los umbrales en el texto visible', () => {
    const items = legendItems();

    expect(items.map((item) => item.firstChild?.textContent?.trim())).toEqual([
      'common.latencyChart.legend.healthy',
      'common.latencyChart.legend.warning',
      'common.latencyChart.legend.critical',
      'common.latencyChart.legend.cut',
    ]);
  });

  it('la ayuda al pasar el cursor interpola los umbrales reales que comparte el servicio', () => {
    const [healthy, warning, , cut] = legendItems();
    const params = JSON.stringify({ warning: 100, critical: 250, lossWarning: 2, lossCritical: 9 });

    expect(healthy.title).toBe(`common.latencyChart.legendHint.healthy ${params}`);
    expect(warning.title).toBe(`common.latencyChart.legendHint.warning ${params}`);
    expect(cut.title).toBe(`common.latencyChart.legendHint.cut ${params}`);
  });

  it('la misma ayuda queda disponible para lectores de pantalla', () => {
    const [healthy] = legendItems();

    expect(healthy.querySelector('.visually-hidden')?.textContent?.trim()).toBe(healthy.title);
  });
});
