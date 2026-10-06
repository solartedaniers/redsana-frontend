import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { fingerprintFromMac } from './network-fingerprint';
import { NetworkIdentityGateway } from './network-identity.gateway';

// La red se identifica por la MAC de su router (estable mientras no se cambie
// el router). Rust la entrega solo a este proceso local y aquí se convierte en
// hash antes de salir del equipo.
@Injectable()
export class NetworkIdentityTauriGateway extends NetworkIdentityGateway {
  async currentNetworkFingerprint(): Promise<string | null> {
    try {
      const gatewayMac = await invoke<string | null>('current_gateway_mac');
      return gatewayMac ? await fingerprintFromMac(gatewayMac) : null;
    } catch {
      // Sin red o comando fallido: la medición queda sin red, nunca con una adivinada.
      return null;
    }
  }
}
