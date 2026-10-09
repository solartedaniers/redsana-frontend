import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { fingerprintFromMac } from './network-fingerprint';
import { NetworkIdentityGateway } from './network-identity.gateway';

// Identifico la red por la MAC de su router y la convierto en hash antes de que salga del equipo.
@Injectable()
export class NetworkIdentityTauriGateway extends NetworkIdentityGateway {
  async currentNetworkFingerprint(): Promise<string | null> {
    try {
      const gatewayMac = await invoke<string | null>('current_gateway_mac');
      return gatewayMac ? await fingerprintFromMac(gatewayMac) : null;
    } catch {
      // Sin red o con el comando fallido la medición queda sin red; nunca le asigno una adivinada.
      return null;
    }
  }
}
