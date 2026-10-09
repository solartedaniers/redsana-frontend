import { Injectable } from '@angular/core';
import { DiscoveredDevice } from '../models/device.model';
import { UnavailableInEnvironmentError } from '../runtime/unavailable-in-environment.error';
import { LanScanGateway } from './lan-scan.gateway';

// Ningún navegador expone la tabla ARP ni permite sockets crudos.
@Injectable()
export class LanScanWebGateway extends LanScanGateway {
  readonly isAvailable = false;

  scan(): Promise<DiscoveredDevice[]> {
    return Promise.reject(new UnavailableInEnvironmentError());
  }
}
