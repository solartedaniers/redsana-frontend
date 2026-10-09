import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { WifiEncryptionGateway } from './wifi-encryption.gateway';

@Injectable()
export class WifiEncryptionTauriGateway extends WifiEncryptionGateway {
  readonly isAvailable = true;

  async detect(): Promise<string | null> {
    try {
      return await invoke<string>('get_wifi_encryption');
    } catch {
      // Sin WiFi o sin permisos lo trato como "no detectado", no como un error fatal del cuestionario.
      return null;
    }
  }
}
