import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NetworkIdentityGateway } from '../network-identity/network-identity.gateway';
import { NetworkMetricsRepository } from '../repositories/network-metrics.repository';
import { NetworkMeasurementGateway } from './network-measurement.gateway';
import { NetworkMeasurementService } from './network-measurement.service';

/** Imita navigator.locks: el primero toma el candado y los demás esperan. */
function fakeLockManager() {
  let held = false;
  const waiting: (() => void)[] = [];
  return {
    request: (_name: string, callback: () => Promise<unknown>) => {
      if (!held) {
        held = true;
        void callback();
      } else {
        waiting.push(() => void callback());
      }
      return new Promise(() => undefined);
    },
    waitingCount: () => waiting.length,
  };
}

function createTab(): { service: NetworkMeasurementService; measure: ReturnType<typeof vi.fn> } {
  TestBed.resetTestingModule();
  const measure = vi.fn(() => Promise.resolve({ latencyMs: 10, jitterMs: 1, packetLossPercent: 0 }));
  TestBed.configureTestingModule({
    providers: [
      NetworkMeasurementService,
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: AuthService, useValue: { isAuthenticated: signal(true) } },
      { provide: NetworkMeasurementGateway, useValue: { measure, source: 'web' } },
      { provide: NetworkIdentityGateway, useValue: { currentNetworkFingerprint: () => Promise.resolve(null) } },
      { provide: NetworkMetricsRepository, useValue: { record: () => of({}) } },
    ],
  });
  return { service: TestBed.inject(NetworkMeasurementService), measure };
}

describe('NetworkMeasurementService con varias pestañas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('solo la pestaña que obtiene el candado mide; la otra queda en espera', async () => {
    const locks = fakeLockManager();
    vi.stubGlobal('navigator', { ...navigator, locks });

    const first = createTab();
    first.service.start();
    TestBed.tick();
    await Promise.resolve();
    const second = createTab();
    second.service.start();
    TestBed.tick();
    await Promise.resolve();

    expect(first.measure).toHaveBeenCalledTimes(1);
    expect(second.measure).not.toHaveBeenCalled();
    expect(locks.waitingCount()).toBe(1);
  });

  it('sin Web Locks (navegador viejo) mide igual, como antes', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined });

    const tab = createTab();
    tab.service.start();
    TestBed.tick();
    await Promise.resolve();

    expect(tab.measure).toHaveBeenCalledTimes(1);
  });
});
