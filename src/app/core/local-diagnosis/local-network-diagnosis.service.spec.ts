import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NetworkThresholdsService } from '../network-thresholds/network-thresholds.service';
import {
  FALLBACK_NETWORK_STATUS_THRESHOLDS,
  FALLBACK_ROUTER_DIAGNOSIS_LIMITS,
} from '../network-thresholds/network-thresholds.config';
import { LocalNetworkDiagnosisService } from './local-network-diagnosis.service';

const START = Date.parse('2026-10-24T12:00:00Z');
const at = (minute: number) => new Date(START + minute * 60_000).toISOString();
const ROUTER_OK = { latencyMs: 20, jitterMs: 1, packetLossPercent: 0, gatewayLatencyMs: 4 };
const INTERNET_DOWN_ROUTER_OK = { latencyMs: 0, jitterMs: 0, packetLossPercent: 100, gatewayLatencyMs: 4 };
const INTERNET_DOWN_NO_ROUTER = { latencyMs: 0, jitterMs: 0, packetLossPercent: 100, gatewayLatencyMs: null };

function openApp() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: NetworkThresholdsService,
        useValue: {
          thresholds: signal(FALLBACK_NETWORK_STATUS_THRESHOLDS),
          routerLimits: signal(FALLBACK_ROUTER_DIAGNOSIS_LIMITS),
        },
      },
    ],
  });
  return TestBed.inject(LocalNetworkDiagnosisService);
}

describe('LocalNetworkDiagnosisService (diagnóstico del escritorio sin conexión)', () => {
  beforeEach(() => localStorage.clear());

  it('sin mediciones del equipo no hay diagnóstico local', () => {
    expect(openApp().current()).toBeNull();
  });

  it('internet caído con el router respondiendo: el problema es del proveedor', () => {
    const service = openApp();

    service.record(at(0), INTERNET_DOWN_ROUTER_OK);

    expect(service.current()).toEqual({ diagnosis: 'provider', gatewayLatencyMs: 4, recordedAt: at(0) });
  });

  it('internet caído y el router dejó de responder hace poco: WiFi o router', () => {
    const service = openApp();
    service.record(at(0), ROUTER_OK);

    service.record(at(5), INTERNET_DOWN_NO_ROUTER);

    expect(service.current()?.diagnosis).toBe('router_unreachable');
  });

  it('la última respuesta del router sobrevive a reiniciar la app', () => {
    openApp().record(at(0), ROUTER_OK);

    const restarted = openApp();
    restarted.record(at(5), INTERNET_DOWN_NO_ROUTER);

    expect(restarted.current()?.diagnosis).toBe('router_unreachable');
  });

  it('si el router respondió hace más del límite, o nunca, no se lo acusa', () => {
    const service = openApp();
    service.record(at(0), INTERNET_DOWN_NO_ROUTER);
    expect(service.current()).toBeNull();

    service.record(at(1), ROUTER_OK);
    service.record(at(1 + FALLBACK_ROUTER_DIAGNOSIS_LIMITS.gatewayRecentReplyMinutes + 1), INTERNET_DOWN_NO_ROUTER);
    expect(service.current()).toBeNull();
  });
});
