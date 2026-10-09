import { Injectable } from '@angular/core';
import { WifiEncryptionGateway } from './wifi-encryption.gateway';

// Ningún navegador expone el cifrado de la red WiFi actual.
@Injectable()
export class WifiEncryptionWebGateway extends WifiEncryptionGateway {
  readonly isAvailable = false;

  detect(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
