import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { WifiEncryptionGateway } from './wifi-encryption.gateway';

@Injectable()
export class WifiEncryptionTauriGateway extends WifiEncryptionGateway {
  async detect(): Promise<string | null> {
    try {
      return await invoke<string>('get_wifi_encryption');
    } catch {
      // Sin WiFi, permisos insuficientes, etc.: se trata como "no detectado",
      // no como error fatal del cuestionario.
      return null;
    }
  }
}
