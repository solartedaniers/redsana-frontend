import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LanScanGateway } from '../../../core/lan-scan/lan-scan.gateway';
import { NetworkDevice } from '../../../core/models/device.model';
import { DevicesRepository } from '../../../core/repositories/devices.repository';
import { DevicesMap } from './devices-map';

function device(index: number, isOnline: boolean): NetworkDevice {
  return {
    id: `device-${index}`,
    name: '',
    macAddress: `aa-bb-cc-00-00-${index.toString(16).padStart(2, '0')}`,
    ipAddress: `192.168.0.${index}`,
    trust: 'unknown',
    firstSeen: '2026-10-01T00:00:00Z',
    lastSeen: '2026-10-01T00:00:00Z',
    isOnline,
  };
}

async function renderWith(devices: NetworkDevice[]): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: DevicesRepository, useValue: { getDevices: () => of(devices) } },
      { provide: LanScanGateway, useValue: { isAvailable: false } },
    ],
  });
  const fixture = TestBed.createComponent(DevicesMap);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('DevicesMap topology', () => {
  for (const connected of [3, 20]) {
    it(`dibuja exactamente ${connected} puntos para ${connected} dispositivos conectados, cada uno en su posición`, async () => {
      // Los desconectados (p. ej. de otra red) no deben aparecer en el mapa.
      const devices = [...Array.from({ length: connected }, (_, i) => device(i, true)), device(99, false)];

      const nodes = [...(await renderWith(devices)).querySelectorAll<HTMLElement>('.topology__node')];

      expect(nodes).toHaveLength(connected);
      expect(new Set(nodes.map((node) => node.style.transform)).size).toBe(connected);
    });
  }
});

describe('DevicesMap trust marking', () => {
  it('marcar como confiable solo llama a setTrust: no escanea ni sincroniza', async () => {
    const repository = {
      getDevices: () => of([device(1, true)]),
      setTrust: vi.fn(() => of(undefined)),
      syncDiscoveredDevices: vi.fn(),
    };
    const lanScan = { isAvailable: true, scan: vi.fn(() => Promise.resolve([])) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: DevicesRepository, useValue: repository },
        { provide: LanScanGateway, useValue: lanScan },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    // El escaneo automático al entrar ya ocurrió; desde aquí no debe repetirse.
    lanScan.scan.mockClear();
    repository.syncDiscoveredDevices.mockClear();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.device-actions button')!.click();
    await fixture.whenStable();

    expect(repository.setTrust).toHaveBeenCalledExactlyOnceWith('device-1', 'trusted');
    expect(lanScan.scan).not.toHaveBeenCalled();
    expect(repository.syncDiscoveredDevices).not.toHaveBeenCalled();
  });
});
