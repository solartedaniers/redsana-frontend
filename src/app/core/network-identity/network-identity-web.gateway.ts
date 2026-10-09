import { Injectable } from '@angular/core';
import { NetworkIdentityGateway } from './network-identity.gateway';

// El navegador no ve la red local, y la IP pública no sirve: cambia y la comparten muchos hogares (CGNAT).
@Injectable()
export class NetworkIdentityWebGateway extends NetworkIdentityGateway {
  currentNetworkFingerprint(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
