import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DevicesRepository } from '../../../core/repositories/devices.repository';
import { LanScanGateway } from '../../../core/lan-scan/lan-scan.gateway';
import { DeviceNetworkRole, DeviceTrust, NetworkDevice } from '../../../core/models/device.model';
import { DeviceKind, inferDeviceKind } from '../../../core/domain/device-kind';
import { layoutTopologyNodes } from '../../../core/domain/topology-layout';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../shared/components/icon/icon';

// Alto mínimo del mapa (igual al de .topology en el SCSS) y margen para el
// halo del punto más externo cuando hay tantos dispositivos que se abren anillos extra.
const TOPOLOGY_MIN_HEIGHT_REM = 24;
const TOPOLOGY_EDGE_MARGIN_REM = 1.5;
// En una red de campus llegan ~900 equipos: pintarlos todos creaba ~16 000
// nodos DOM (~1 s de bloqueo). La lista crece de a una página y el mapa dibuja
// solo los primeros anillos; el contador sigue mostrando el total real.
const DEVICES_PAGE_SIZE = 50;
const MAX_TOPOLOGY_NODES = 70;

// Router primero y luego este equipo: los dos que el usuario reconoce enseguida.
const ROLE_ORDER: Record<DeviceNetworkRole, number> = { gateway: 0, this_device: 1, other: 2 };

const DEVICE_KIND_ICON: Record<DeviceKind, 'phone' | 'computer' | 'devices'> = {
  phone: 'phone',
  computer: 'computer',
  unknown: 'devices',
};

@Component({
  selector: 'app-devices-map',
  imports: [DatePipe, PageHeader, TranslatePipe, Icon],
  templateUrl: './devices-map.html',
  styleUrl: './devices-map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesMap {
  private readonly repository = inject(DevicesRepository);
  private readonly lanScanGateway = inject(LanScanGateway);

  protected readonly isScanAvailable = this.lanScanGateway.isAvailable;
  protected readonly devices = signal<NetworkDevice[]>([]);
  // El backend guarda todo el historial del usuario (incluidas otras redes en
  // las que escaneó alguna vez); la pantalla muestra solo lo que vio el escaneo
  // más reciente, que es lo que está conectado ahora (is_online lo calcula el backend).
  protected readonly connectedDevices = computed(() =>
    this.devices()
      .filter((device) => device.isOnline)
      .sort((a, b) => ROLE_ORDER[a.networkRole ?? 'other'] - ROLE_ORDER[b.networkRole ?? 'other'])
  );
  // El router es la red misma (el hub del mapa), no un dispositivo conectado a
  // ella: se lista aparte pero no cuenta. Este equipo sí cuenta.
  protected readonly networkMembers = computed(() =>
    this.connectedDevices().filter((device) => device.networkRole !== 'gateway')
  );
  protected readonly visibleCount = signal(DEVICES_PAGE_SIZE);
  protected readonly visibleDevices = computed(() => this.connectedDevices().slice(0, this.visibleCount()));
  protected readonly hiddenDeviceCount = computed(() => Math.max(0, this.connectedDevices().length - this.visibleCount()));
  protected readonly mapShownCount = computed(() => Math.min(this.networkMembers().length, MAX_TOPOLOGY_NODES));
  // Un punto del mapa por dispositivo conectado (hasta MAX_TOPOLOGY_NODES), cada uno en su propia posición.
  protected readonly topologyNodes = computed(() => {
    const devices = this.networkMembers().slice(0, MAX_TOPOLOGY_NODES);
    const offsets = layoutTopologyNodes(devices.length);
    return devices.map((device, index) => ({
      device,
      transform: `translate(${offsets[index].xRem}rem, ${offsets[index].yRem}rem)`,
      radiusRem: Math.hypot(offsets[index].xRem, offsets[index].yRem),
    }));
  });
  protected readonly topologyHeightRem = computed(() =>
    Math.max(
      TOPOLOGY_MIN_HEIGHT_REM,
      ...this.topologyNodes().map((node) => 2 * (node.radiusRem + TOPOLOGY_EDGE_MARGIN_REM))
    )
  );
  protected readonly isScanning = signal(false);
  protected readonly lastScanFindings = signal<NetworkDevice[] | null>(null);
  protected readonly scanFailed = signal(false);
  protected readonly expandedDeviceIds = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.repository.getDevices().subscribe((devices) => this.devices.set(devices));
    // Donde se puede escanear (escritorio), se escanea al entrar: así la lista
    // refleja la red actual aunque el último escaneo guardado sea de otra red.
    if (this.isScanAvailable) {
      void this.scan();
    }
  }

  protected async scan(): Promise<void> {
    this.isScanning.set(true);
    this.lastScanFindings.set(null);
    this.scanFailed.set(false);

    try {
      // 1) descubre qué hay realmente en la red (Tauri/ARP); 2) sincroniza el
      // backend con eso, que crea lo nuevo y refresca la presencia de lo conocido.
      const discovered = await this.lanScanGateway.scan();
      this.repository.syncDiscoveredDevices(discovered).subscribe({
        next: (devices) => {
          this.isScanning.set(false);
          this.devices.set(devices);
          // El router y este equipo no son "intrusos" posibles: solo se revisan los demás.
          this.lastScanFindings.set(
            devices.filter((device) => device.isOnline && device.networkRole === 'other' && device.trust !== 'trusted')
          );
        },
        error: (error) => {
          // La causa real (ej. fallo de sincronización con el backend) queda en
          // consola: el signal solo dispara el mensaje genérico de la UI.
          console.error('[DevicesMap] fallo al sincronizar dispositivos escaneados', error);
          this.isScanning.set(false);
          this.scanFailed.set(true);
        },
      });
    } catch (error) {
      // Sin Tauri, sin permisos, ipconfig/arp fallaron, etc. El mensaje real
      // (qué paso exacto falló) viaja en el Err de Rust y aparece aquí.
      console.error('[DevicesMap] fallo al escanear la LAN', error);
      this.isScanning.set(false);
      this.scanFailed.set(true);
    }
  }

  protected showMoreDevices(): void {
    this.visibleCount.update((count) => count + DEVICES_PAGE_SIZE);
  }

  protected setTrust(deviceId: string, trust: DeviceTrust): void {
    this.repository.setTrust(deviceId, trust).subscribe(() => {
      this.devices.update((current) =>
        current.map((device) => (device.id === deviceId ? { ...device, trust } : device))
      );
    });
  }

  protected deviceIcon(device: NetworkDevice): 'phone' | 'computer' | 'devices' {
    return DEVICE_KIND_ICON[inferDeviceKind(device.macAddress)];
  }

  protected deviceKindLabelKey(device: NetworkDevice): string {
    return `user.devicesMap.kind.${inferDeviceKind(device.macAddress)}`;
  }

  protected isExpanded(deviceId: string): boolean {
    return this.expandedDeviceIds().has(deviceId);
  }

  protected toggleExpanded(deviceId: string): void {
    this.expandedDeviceIds.update((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }
}
