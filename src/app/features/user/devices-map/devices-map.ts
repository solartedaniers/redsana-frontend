import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DevicesRepository } from '../../../core/repositories/devices.repository';
import { LanScanGateway } from '../../../core/lan-scan/lan-scan.gateway';
import { DeviceNetworkRole, DeviceTrust, NetworkDevice } from '../../../core/models/device.model';
import { layoutTopologyNodes } from '../../../core/domain/topology-layout';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../shared/components/icon/icon';
import { DeviceCard } from './device-card/device-card';

// Alto mínimo del mapa (el mismo de .topology) y margen para el halo del punto más externo.
const TOPOLOGY_MIN_HEIGHT_REM = 24;
const TOPOLOGY_EDGE_MARGIN_REM = 1.5;
// En una red de campus llegan ~900 equipos y pintarlos todos bloqueaba ~1 s; por eso pagino la lista y limito el mapa.
const DEVICES_PAGE_SIZE = 50;
const MAX_TOPOLOGY_NODES = 70;

const TRUST_LEVELS: readonly DeviceTrust[] = ['trusted', 'unknown', 'blocked'];

// Primero el router y luego este equipo, que son los que el usuario reconoce enseguida.
const ROLE_ORDER: Record<DeviceNetworkRole, number> = { gateway: 0, this_device: 1, other: 2 };

@Component({
  selector: 'app-devices-map',
  imports: [PageHeader, TranslatePipe, Icon, DeviceCard],
  templateUrl: './devices-map.html',
  styleUrl: './devices-map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesMap {
  private readonly repository = inject(DevicesRepository);
  private readonly lanScanGateway = inject(LanScanGateway);

  protected readonly isScanAvailable = this.lanScanGateway.isAvailable;
  protected readonly devices = signal<NetworkDevice[]>([]);
  // El backend guarda todo el historial; aquí muestro solo lo del último escaneo, que es lo conectado ahora.
  protected readonly connectedDevices = computed(() =>
    this.devices()
      .filter((device) => device.isOnline)
      .sort((a, b) => ROLE_ORDER[a.networkRole ?? 'other'] - ROLE_ORDER[b.networkRole ?? 'other'])
  );
  // El router es la red misma (el centro del mapa): se lista aparte y no cuenta. Este equipo sí cuenta.
  protected readonly networkMembers = computed(() =>
    this.connectedDevices().filter((device) => device.networkRole !== 'gateway')
  );
  protected readonly visibleCount = signal(DEVICES_PAGE_SIZE);
  protected readonly visibleDevices = computed(() => this.connectedDevices().slice(0, this.visibleCount()));
  protected readonly hiddenDeviceCount = computed(() => Math.max(0, this.connectedDevices().length - this.visibleCount()));
  /** Conteo real por nivel de confianza para la leyenda del radar. */
  protected readonly trustCounts = computed(() =>
    TRUST_LEVELS.map((trust) => ({ trust, count: this.networkMembers().filter((device) => device.trust === trust).length }))
  );
  protected readonly mapShownCount = computed(() => Math.min(this.networkMembers().length, MAX_TOPOLOGY_NODES));
  // Un punto por dispositivo conectado (hasta MAX_TOPOLOGY_NODES), cada uno en su posición.
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

  constructor() {
    this.repository.getDevices().subscribe((devices) => this.devices.set(devices));
    // En escritorio escaneo al entrar para que la lista refleje la red actual.
    if (this.isScanAvailable) {
      void this.scan();
    }
  }

  protected async scan(): Promise<void> {
    this.isScanning.set(true);
    this.lastScanFindings.set(null);
    this.scanFailed.set(false);

    try {
      // Primero descubro lo que hay en la red y luego lo sincronizo con el backend.
      const discovered = await this.lanScanGateway.scan();
      this.repository.syncDiscoveredDevices(discovered).subscribe({
        next: (devices) => {
          this.isScanning.set(false);
          this.devices.set(devices);
          // El router y este equipo no pueden ser intrusos: solo reviso los demás.
          this.lastScanFindings.set(
            devices.filter((device) => device.isOnline && device.networkRole === 'other' && device.trust !== 'trusted')
          );
        },
        error: (error) => {
          // La causa real queda en consola; en pantalla solo va el mensaje genérico.
          console.error('[DevicesMap] fallo al sincronizar dispositivos escaneados', error);
          this.isScanning.set(false);
          this.scanFailed.set(true);
        },
      });
    } catch (error) {
      // Sin Tauri, sin permisos o con ipconfig/arp fallando; el detalle llega en el Err de Rust.
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
}
