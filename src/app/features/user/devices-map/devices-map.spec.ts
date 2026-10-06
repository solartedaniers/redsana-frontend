import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LanScanGateway } from '../../../core/lan-scan/lan-scan.gateway';
import { NetworkDevice } from '../../../core/models/device.model';
import { DevicesRepository } from '../../../core/repositories/devices.repository';
import { DevicesMap } from './devices-map';

function device(index: number, isOnline: boolean, networkRole: NetworkDevice['networkRole'] = 'other'): NetworkDevice {
  return {
    id: `device-${index}`,
    name: '',
    macAddress: `aa-bb-cc-00-00-${index.toString(16).padStart(2, '0')}`,
    ipAddress: `192.168.0.${index}`,
    trust: 'unknown',
    firstSeen: '2026-10-01T00:00:00Z',
    lastSeen: '2026-10-01T00:00:00Z',
    isOnline,
    networkRole,
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

describe('DevicesMap connected count', () => {
  // Caso real: router + celular en la tabla ARP + este PC. Antes se mostraba 1
  // (solo el router: el PC no se contaba y el celular a veces no respondía).
  it('cuenta este equipo y los demás, pero no el router, que es el hub del mapa', async () => {
    const devices = [device(1, true, 'gateway'), device(100, true, 'other'), device(103, true, 'this_device')];

    const element = await renderWith(devices);

    expect(element.querySelector('.devices-hero .status-badge')?.textContent?.trim()).toBe('2');
    expect(element.querySelectorAll('.topology__node')).toHaveLength(2);
    // El router sigue apareciendo en la lista, marcado como tal.
    expect(element.querySelectorAll('.device-card')).toHaveLength(3);
    expect(element.querySelector('.device-card .status-badge')?.textContent?.trim()).toBe('user.devicesMap.role.gateway');
  });
});
