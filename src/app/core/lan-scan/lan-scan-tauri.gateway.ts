import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { DiscoveredDevice } from '../models/device.model';
import { LanScanGateway } from './lan-scan.gateway';

@Injectable()
export class LanScanTauriGateway extends LanScanGateway {
  readonly isAvailable = true;

  scan(manual = false): Promise<DiscoveredDevice[]> {
    return invoke<DiscoveredDevice[]>(manual ? 'scan_present_devices' : 'scan_connected_devices');
  }
}
