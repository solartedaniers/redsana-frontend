import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DevicesRepository } from '../../../core/repositories/devices.repository';
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

  protected readonly devices = signal<NetworkDevice[]>([]);
  protected readonly isScanning = signal(false);
  protected readonly lastScanFindings = signal<NetworkDevice[] | null>(null);

  constructor() {
    this.repository.getDevices().subscribe((devices) => this.devices.set(devices));
  }

  protected scan(): void {
    this.isScanning.set(true);
    this.lastScanFindings.set(null);
    this.repository.scanForIntruders().subscribe((findings) => {
      this.isScanning.set(false);
      this.lastScanFindings.set(findings);
    });
  }

  protected setTrust(deviceId: string, trust: DeviceTrust): void {
    this.repository.setTrust(deviceId, trust).subscribe(() => {
      this.devices.update((current) =>
        current.map((device) => (device.id === deviceId ? { ...device, trust } : device))
      );
    });
  }
}
