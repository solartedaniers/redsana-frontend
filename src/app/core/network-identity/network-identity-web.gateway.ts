import { Injectable } from '@angular/core';
import { NetworkIdentityGateway } from './network-identity.gateway';

// El navegador no puede ver la red local (ni la MAC del router ni su IP privada).
// La IP pública no sirve: cambia con frecuencia y la comparten muchos hogares (CGNAT).
@Injectable()
export class NetworkIdentityWebGateway extends NetworkIdentityGateway {
  currentNetworkFingerprint(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
