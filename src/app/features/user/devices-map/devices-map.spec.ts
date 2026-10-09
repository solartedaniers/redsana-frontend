import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
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
  // Caso real: router, celular y este PC en la tabla ARP; antes solo se contaba el router.
  it('cuenta este equipo y los demás, pero no el router, que es el hub del mapa', async () => {
    const devices = [device(1, true, 'gateway'), device(100, true, 'other'), device(103, true, 'this_device')];

    const element = await renderWith(devices);

    expect(element.querySelector('.devices-hero .status-badge')?.textContent?.trim()).toBe('2');
    expect(element.querySelectorAll('.topology__node')).toHaveLength(2);
    // El router sigue en la lista, marcado como tal.
    expect(element.querySelectorAll('.device-card')).toHaveLength(3);
    expect(element.querySelector('.device-card .status-badge')?.textContent?.trim()).toBe('user.devicesMap.role.gateway');
  });
});

describe('DevicesMap failed scan', () => {
  it('no muestra el número viejo cuando el escaneo falla, y pide intentar de nuevo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const devices = [device(1, true, 'gateway'), device(100, true, 'other'), device(103, true, 'this_device')];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: DevicesRepository, useValue: { getDevices: () => of(devices) } },
        { provide: LanScanGateway, useValue: { isAvailable: true, scan: () => Promise.reject(new Error('arp failed')) } },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.devices-hero .status-badge')?.textContent?.trim()).toBe('user.devicesMap.countUnavailable');
    expect(element.querySelector('.scan-result.error')?.textContent?.trim()).toBe('user.devicesMap.scanError');
  });
});

describe('DevicesMap trust marks', () => {
  it('un equipo marcado se puede devolver a "Desconocido" con "Quitar marca"', async () => {
    const marked = { ...device(7, true), trust: 'blocked' as const };
    const repository = { getDevices: () => of([marked]), setTrust: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: DevicesRepository, useValue: repository },
        { provide: LanScanGateway, useValue: { isAvailable: false } },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const clear = [...element.querySelectorAll<HTMLButtonElement>('.device-actions button')].find(
      (button) => button.textContent?.trim() === 'user.devicesMap.clearTrust'
    );
    clear!.click();

    expect(repository.setTrust).toHaveBeenCalledExactlyOnceWith('device-7', 'unknown');
    expect(element.querySelector('.trust-note')?.textContent?.trim()).toBe('user.devicesMap.trustNote');
  });
});

describe('DevicesMap con una red de campus (~900 equipos)', () => {
  const campus = () => [device(0, true, 'gateway'), device(1, true, 'this_device'), ...Array.from({ length: 898 }, (_, i) => device(i + 2, true))];

  it('pinta una página de la lista, el mapa limitado y el contador con el total real', async () => {
    const element = await renderWith(campus());

    expect(element.querySelectorAll('.device-card')).toHaveLength(50);
    expect(element.querySelectorAll('.topology__node')).toHaveLength(70);
    expect(element.querySelector('.topology__limit')).not.toBeNull();
    expect(element.querySelector('.devices-hero .status-badge')?.textContent?.trim()).toBe('899'); // todos menos el router
    expect(element.querySelector('.show-more-button')).not.toBeNull();
  });

  it('"Ver más" agrega la siguiente página', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: DevicesRepository, useValue: { getDevices: () => of(campus()) } },
        { provide: LanScanGateway, useValue: { isAvailable: false } },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.show-more-button')!.click();
    fixture.detectChanges();

    expect(element.querySelectorAll('.device-card')).toHaveLength(100);
  });
});

describe('DevicesMap search', () => {
  const campus = () => [device(0, true, 'gateway'), ...Array.from({ length: 120 }, (_, i) => device(i + 1, true))];

  async function setup(devices$ = new Subject<NetworkDevice[]>()) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: DevicesRepository, useValue: { getDevices: () => devices$ } },
        { provide: LanScanGateway, useValue: { isAvailable: false } },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = () => element.querySelector<HTMLInputElement>('app-device-search-box input')!;
    const type = (text: string) => {
      input().value = text;
      input().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const ips = () => [...element.querySelectorAll('.device-card')].map((card) => card.querySelector('.device-meta')?.textContent?.split('·')[1]?.trim());
    return { fixture, element, input, type, ips, devices$ };
  }

  it('busca en todos los cargados, no solo en la primera página de 50', async () => {
    const { devices$, type, ips, element, fixture } = await setup();
    devices$.next(campus());
    fixture.detectChanges();

    type('  192.168.0.115 ');

    expect(ips()).toEqual(['192.168.0.115']);
    expect(element.querySelector('.search__count')?.textContent?.trim()).toBe('user.devicesMap.search.count');
    expect(element.querySelectorAll('.topology__node')).toHaveLength(70);
  });

  it('la búsqueda se mantiene cuando llega un escaneo nuevo y Escape la borra', async () => {
    const { devices$, type, ips, input, fixture } = await setup();
    devices$.next(campus());
    type('192.168.0.11');
    devices$.next(campus());
    fixture.detectChanges();

    expect(ips()).toEqual(['192.168.0.11', '192.168.0.110', '192.168.0.111', '192.168.0.112', '192.168.0.113', '192.168.0.114', '192.168.0.115', '192.168.0.116', '192.168.0.117', '192.168.0.118', '192.168.0.119']);

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(input().value).toBe('');
    expect(ips()).toHaveLength(50);
  });

  it('sin coincidencias muestra el aviso con la opción de limpiar', async () => {
    const { devices$, type, element, fixture } = await setup();
    devices$.next(campus());
    fixture.detectChanges();
    type('10.9.9.9');

    expect(element.querySelectorAll('.device-card')).toHaveLength(0);
    element.querySelector<HTMLButtonElement>('.search__empty button')!.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.device-card')).toHaveLength(50);
  });
});
