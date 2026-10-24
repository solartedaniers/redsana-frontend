import { TestBed } from '@angular/core/testing';
import { NetworkDiagnosis } from '../../../core/models/network.model';
import { NetworkDiagnosisPanel } from './network-diagnosis-panel';

// Sin diccionario cargado, la traducción devuelve la clave: así se ve qué texto eligió el panel.
function render(diagnosis: NetworkDiagnosis, possibleBusyDevice = false, offlineMeasuredAt: string | null = null) {
  const fixture = TestBed.createComponent(NetworkDiagnosisPanel);
  fixture.componentRef.setInput('diagnosis', diagnosis);
  fixture.componentRef.setInput('gatewayLatencyMs', 4.26);
  fixture.componentRef.setInput('possibleBusyDevice', possibleBusyDevice);
  fixture.componentRef.setInput('offlineMeasuredAt', offlineMeasuredAt);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return {
    copy: element.querySelector('.surface-panel__copy')?.textContent?.trim(),
    offline: element.querySelector('.diagnosis__offline')?.textContent?.trim() ?? null,
    verdict: element.querySelector('.diagnosis__verdict')?.textContent?.trim(),
    restart: element.querySelector('.diagnosis__restart')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    hint: element.querySelector('.diagnosis__hint')?.textContent?.trim() ?? null,
  };
}

describe('NetworkDiagnosisPanel', () => {
  it('router lento: culpa al WiFi o al router y dice qué revisar antes de reiniciar', () => {
    expect(render('router')).toEqual({
      copy: 'user.dashboard.diagnosis.routerLatency',
      offline: null,
      verdict: 'user.dashboard.diagnosis.router.verdict',
      restart: 'user.dashboard.diagnosis.restartLabel user.dashboard.diagnosis.router.restart',
      hint: null,
    });
  });

  it('router bien e internet mal: culpa al proveedor y avisa que reiniciar probablemente no ayude', () => {
    expect(render('provider').verdict).toBe('user.dashboard.diagnosis.provider.verdict');
    expect(render('provider').restart).toContain('user.dashboard.diagnosis.provider.restart');
  });

  it('todo bien: no habla de reiniciar el router', () => {
    expect(render('ok')).toMatchObject({ verdict: 'user.dashboard.diagnosis.ok.verdict', restart: null, hint: null });
  });

  it('router sin responder con internet caído: WiFi o router, sin latencia que mostrar y con qué revisar', () => {
    expect(render('router_unreachable')).toMatchObject({
      copy: 'user.dashboard.diagnosis.routerNoReply',
      verdict: 'user.dashboard.diagnosis.router_unreachable.verdict',
      restart: 'user.dashboard.diagnosis.restartLabel user.dashboard.diagnosis.router_unreachable.restart',
    });
  });

  it('sin conexión con el servidor avisa que el diagnóstico es del equipo', () => {
    expect(render('provider', false, '2026-10-24T17:05:00Z').offline).toBe('user.dashboard.diagnosis.offlineNote');
  });

  it('la pista de dispositivo saturando solo aparece cuando el backend la marca como posible', () => {
    expect(render('router', true).hint).toBe('user.dashboard.diagnosis.possibleBusyDevice');
  });
});
