import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DevicesRepository } from '../../../core/repositories/devices.repository';
import { LanScanGateway } from '../../../core/lan-scan/lan-scan.gateway';
import { DeviceTrust, NetworkDevice } from '../../../core/models/device.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../shared/components/icon/icon';

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
        error: () => {
          this.isScanning.set(false);
          this.scanFailed.set(true);
        },
      });
    } catch {
      // Sin Tauri, sin permisos, ipconfig/arp fallaron, etc.
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
}
