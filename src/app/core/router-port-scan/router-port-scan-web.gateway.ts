import { Injectable } from '@angular/core';
import { RouterPortScanGateway } from './router-port-scan.gateway';

// El navegador no puede abrir conexiones TCP arbitrarias a la red local.
@Injectable()
export class RouterPortScanWebGateway extends RouterPortScanGateway {
  readonly isAvailable = false;

  scanOpenPorts(): Promise<number[] | null> {
    return Promise.resolve(null);
  }
}
