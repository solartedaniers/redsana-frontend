import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { DiscoveredDevice } from '../models/device.model';
import { LanScanGateway } from './lan-scan.gateway';

@Injectable()
export class LanScanTauriGateway extends LanScanGateway {
  scan(): Promise<DiscoveredDevice[]> {
    return invoke<DiscoveredDevice[]>('scan_connected_devices');
  }
}
