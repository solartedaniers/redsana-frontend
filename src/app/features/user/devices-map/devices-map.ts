import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DevicesRepository } from '../../../core/repositories/devices.repository';
import { LanScanGateway } from '../../../core/lan-scan/lan-scan.gateway';
import { DeviceTrust, NetworkDevice } from '../../../core/models/device.model';
import { DeviceKind, inferDeviceKind } from '../../../core/domain/device-kind';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../shared/components/icon/icon';

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

  protected readonly devices = signal<NetworkDevice[]>([]);
  protected readonly isScanning = signal(false);
  protected readonly lastScanFindings = signal<NetworkDevice[] | null>(null);
  protected readonly scanFailed = signal(false);
  protected readonly expandedDeviceIds = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.repository.getDevices().subscribe((devices) => this.devices.set(devices));
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
          this.lastScanFindings.set(devices.filter((device) => device.trust !== 'trusted'));
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
