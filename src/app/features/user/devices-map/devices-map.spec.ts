import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { LanScanGateway } from '../../../core/lan-scan/lan-scan.gateway';
import { NetworkDevice } from '../../../core/models/device.model';
import { DevicesRepository } from '../../../core/repositories/devices.repository';
import { LAN_SCAN_CONFIG } from '../../../core/lan-scan/lan-scan.config';
import { LiveUpdates } from '../../../core/realtime/live-updates';
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

describe('DevicesMap manual scan', () => {
  it('el escaneo al entrar y el del botón usan la misma regla: confirmar cada equipo en el momento', async () => {
    const repository = { getDevices: () => of([]), syncDiscoveredDevices: vi.fn(() => of([])) };
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
    fixture.detectChanges();

    expect(lanScan.scan).toHaveBeenCalledExactlyOnceWith(true);
    expect(repository.syncDiscoveredDevices).toHaveBeenCalledExactlyOnceWith([], true);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.scan-button')!.click();
    await fixture.whenStable();

    expect(lanScan.scan).toHaveBeenLastCalledWith(true);
    expect(repository.syncDiscoveredDevices).toHaveBeenLastCalledWith([], true);
  });
});

describe('DevicesMap client isolation', () => {
  async function scanReturning(devices: NetworkDevice[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        {
          provide: DevicesRepository,
          useValue: { getDevices: () => of([]), syncDiscoveredDevices: () => of(devices) },
        },
        { provide: LanScanGateway, useValue: { isAvailable: true, scan: () => Promise.resolve([]) } },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('si el escaneo solo ve al router y a este equipo, explica que la red puede ocultar a los demás', async () => {
    const element = await scanReturning([device(1, true, 'gateway'), device(52, true, 'this_device')]);

    expect(element.querySelector('.scan-hint')?.textContent?.trim()).toBe('user.devicesMap.isolationHint');
  });

  it('con otros equipos a la vista no muestra el aviso', async () => {
    const element = await scanReturning([
      device(1, true, 'gateway'),
      device(52, true, 'this_device'),
      device(60, true),
    ]);

    expect(element.querySelector('.scan-hint')).toBeNull();
  });
});

describe('DevicesMap con cientos de equipos tras un escaneo manual', () => {
  it('sincroniza 450, pinta una página de la lista y el mapa limitado con "X de Y"', async () => {
    const scanned = [
      device(0, true, 'gateway'),
      device(1, true, 'this_device'),
      ...Array.from({ length: 448 }, (_, i) => device(i + 2, true)),
    ];
    const repository = { getDevices: () => of([]), syncDiscoveredDevices: vi.fn(() => of(scanned)) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: DevicesRepository, useValue: repository },
        { provide: LanScanGateway, useValue: { isAvailable: true, scan: () => Promise.resolve([]) } },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.devices-hero .status-badge')?.textContent?.trim()).toBe('449');
    expect(element.querySelectorAll('.device-card')).toHaveLength(50);
    expect(element.querySelectorAll('.topology__node')).toHaveLength(70);
    expect(element.querySelector('.topology__limit')?.textContent?.trim()).toBe('user.devicesMap.mapLimited');
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
    expect(element.querySelector('.device-card .status-badge')?.textContent?.trim()).toBe(
      'user.devicesMap.role.gateway',
    );
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
        {
          provide: LanScanGateway,
          useValue: { isAvailable: true, scan: () => Promise.reject(new Error('arp failed')) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.devices-hero .status-badge')?.textContent?.trim()).toBe(
      'user.devicesMap.countUnavailable',
    );
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
      (button) => button.textContent?.trim() === 'user.devicesMap.clearTrust',
    );
    clear!.click();

    expect(repository.setTrust).toHaveBeenCalledExactlyOnceWith('device-7', 'unknown');
    expect(element.querySelector('.trust-note')?.textContent?.trim()).toBe('user.devicesMap.trustNote');
  });
});

describe('DevicesMap con una red de campus (~900 equipos)', () => {
  const campus = () => [
    device(0, true, 'gateway'),
    device(1, true, 'this_device'),
    ...Array.from({ length: 898 }, (_, i) => device(i + 2, true)),
  ];

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
    const ips = () =>
      [...element.querySelectorAll('.device-card')].map((card) =>
        card.querySelector('.device-meta')?.textContent?.split('·')[1]?.trim(),
      );
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

    expect(ips()).toEqual([
      '192.168.0.11',
      '192.168.0.110',
      '192.168.0.111',
      '192.168.0.112',
      '192.168.0.113',
      '192.168.0.114',
      '192.168.0.115',
      '192.168.0.116',
      '192.168.0.117',
      '192.168.0.118',
      '192.168.0.119',
    ]);

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

describe('DevicesMap presence filter', () => {
  it('"Todos" agrega los sin conexión, sin cambiar el contador ni el radar, y el buscador los incluye', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        {
          provide: DevicesRepository,
          useValue: { getDevices: () => of([device(1, true), device(2, true), device(50, false)]) },
        },
        { provide: LanScanGateway, useValue: { isAvailable: false } },
      ],
    });
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const search = (text: string) => {
      const input = element.querySelector<HTMLInputElement>('app-device-search-box input')!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    expect(element.querySelectorAll('.device-card')).toHaveLength(2);
    search('192.168.0.50');
    expect(element.querySelectorAll('.device-card')).toHaveLength(0);

    element.querySelectorAll<HTMLButtonElement>('app-presence-filter-toggle button')[1].click();
    fixture.detectChanges();

    expect(element.querySelectorAll('.device-card')).toHaveLength(1);
    expect(element.querySelector('.device-card .presence-badge')?.getAttribute('data-online')).toBe('false');
    expect(element.querySelector('.devices-hero .status-badge')?.textContent?.trim()).toBe('2');
    expect(element.querySelectorAll('.topology__node')).toHaveLength(2);
  });
});

describe('DevicesMap al entrar, escaneo reciente y avisos de cambios', () => {
  const COUNTER = '.devices-hero .status-badge';

  /** Backend falso: guarda lo que llega en cada sync y lo devuelve en la lista, como haría /devices. */
  function fakeBackend(initial: NetworkDevice[]) {
    let saved = initial;
    return {
      getDevices: vi.fn(() => of(saved)),
      syncDiscoveredDevices: vi.fn(() => of(saved)),
      setScanResult(devices: NetworkDevice[]) {
        saved = devices;
      },
    };
  }

  function configure(repository: object, scan: () => Promise<unknown>): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: DevicesRepository, useValue: repository },
        { provide: LanScanGateway, useValue: { isAvailable: true, scan: vi.fn(scan) } },
      ],
    });
  }

  async function open() {
    const fixture = TestBed.createComponent(DevicesMap);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const network = (others: number) => [
    device(1, true, 'gateway'),
    device(2, true, 'this_device'),
    ...Array.from({ length: others }, (_, i) => device(i + 10, true)),
  ];

  afterEach(() => vi.useRealTimers());

  it('muestra la lista guardada sin esperar al escaneo, que sigue en segundo plano con su indicador', async () => {
    configure(fakeBackend(network(4)), () => new Promise(() => undefined));

    const element = (await open()).nativeElement as HTMLElement;

    expect(element.querySelector(COUNTER)?.textContent?.trim()).toBe('5');
    expect(element.querySelector('.scan-button')?.textContent?.trim()).toBe('user.devicesMap.scanning');
    expect(element.querySelector('.topology--scanning')).not.toBeNull();
  });

  it('una lista guardada que llega después del escaneo no lo pisa', async () => {
    const lateList = new Subject<NetworkDevice[]>();
    configure({ getDevices: () => lateList, syncDiscoveredDevices: () => of(network(2)) }, () => Promise.resolve([]));
    const fixture = await open();

    lateList.next(network(7));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector(COUNTER)?.textContent?.trim()).toBe('3');
  });

  it('quitar equipos baja el conteo y no reaparecen al volver a la pantalla', async () => {
    const backend = fakeBackend([]);
    let lanScanResult = network(5);
    configure(backend, () => {
      backend.setScanResult(lanScanResult);
      return Promise.resolve([]);
    });
    const first = await open();
    expect((first.nativeElement as HTMLElement).querySelector(COUNTER)?.textContent?.trim()).toBe('6');

    lanScanResult = network(2);
    (first.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.scan-button')!.click();
    await first.whenStable();
    first.detectChanges();
    expect((first.nativeElement as HTMLElement).querySelector(COUNTER)?.textContent?.trim()).toBe('3');
    first.destroy();

    // Volver enseguida: hubo un escaneo reciente, así que no se barre de nuevo y se ve lo que guardó el último.
    const scansBefore = backend.syncDiscoveredDevices.mock.calls.length;
    const reopened = await open();
    expect(backend.syncDiscoveredDevices.mock.calls.length).toBe(scansBefore);
    expect((reopened.nativeElement as HTMLElement).querySelector(COUNTER)?.textContent?.trim()).toBe('3');
  });

  it('vuelve a escanear al entrar cuando pasó la ventana de la configuración, y el botón siempre escanea', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const backend = fakeBackend(network(1));
    configure(backend, () => Promise.resolve([]));
    (await open()).destroy();
    expect(backend.syncDiscoveredDevices).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + LAN_SCAN_CONFIG.recentScanWindowMs - 1);
    const recent = await open();
    expect(backend.syncDiscoveredDevices).toHaveBeenCalledTimes(1);
    (recent.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.scan-button')!.click();
    await recent.whenStable();
    expect(backend.syncDiscoveredDevices).toHaveBeenCalledTimes(2);
    recent.destroy();

    vi.setSystemTime(Date.now() + LAN_SCAN_CONFIG.recentScanWindowMs);
    await open();
    expect(backend.syncDiscoveredDevices).toHaveBeenCalledTimes(3);
  });

  it('el botón fuerza un escaneo nuevo mientras corre otro, y el resultado del anterior se descarta', async () => {
    const pending: ((value: unknown[]) => void)[] = [];
    const syncs = [network(6), network(1)];
    const repository = {
      getDevices: () => of([]),
      syncDiscoveredDevices: vi.fn(() => of(syncs.shift()!)),
    };
    configure(repository, () => new Promise((resolve) => pending.push(resolve)));
    const fixture = await open();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.scan-button')!.click();
    pending[1]([]);
    await fixture.whenStable();
    pending[0]([]);
    await fixture.whenStable();
    fixture.detectChanges();

    // Solo se sincronizó el escaneo forzado; el de entrada terminó después y no cuenta.
    expect(repository.syncDiscoveredDevices).toHaveBeenCalledTimes(1);
    expect(element.querySelector(COUNTER)?.textContent?.trim()).toBe('7');
  });

  it('con devices.updated vuelve a pedir la lista, salvo mientras la pantalla escanea', async () => {
    let finishScan: (value: unknown[]) => void = () => undefined;
    const backend = fakeBackend(network(1));
    configure(backend, () => new Promise((resolve) => (finishScan = resolve)));
    const fixture = await open();
    const live = TestBed.inject(LiveUpdates);
    const event = { type: 'devices.updated' as const, owner_id: 'me', data: {}, at: '2026-11-05T00:00:00Z' };
    backend.getDevices.mockClear();

    live.publish(event);
    expect(backend.getDevices).not.toHaveBeenCalled();

    finishScan([]);
    await fixture.whenStable();
    backend.setScanResult(network(3));
    live.publish(event);
    fixture.detectChanges();

    expect(backend.getDevices).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).querySelector(COUNTER)?.textContent?.trim()).toBe('4');
  });
});
