import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { RouterPortScanGateway } from './router-port-scan.gateway';

interface RouterPortScan {
  gateway: string;
  openPorts: number[];
}

@Injectable()
export class RouterPortScanTauriGateway extends RouterPortScanGateway {
  readonly isAvailable = true;

  async scanOpenPorts(): Promise<number[] | null> {
    try {
      return (await invoke<RouterPortScan>('scan_router_open_ports')).openPorts;
    } catch (error) {
      // Sin puerta de enlace o con route fallando, prefiero no evaluar el router antes que darlo por seguro o inseguro.
      console.error('[RouterPortScan] no se pudo escanear el router', error);
      return null;
    }
  }
}
