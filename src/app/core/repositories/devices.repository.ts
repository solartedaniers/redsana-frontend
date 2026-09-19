import { Observable } from 'rxjs';
import { DeviceTrust, DiscoveredDevice, NetworkDevice } from '../models/device.model';

export abstract class DevicesRepository {
  abstract getDevices(householdId?: string): Observable<NetworkDevice[]>;
  /** Sincroniza lo que un escaneo real (Tauri/ARP) encontró en la LAN: crea los
   * dispositivos nuevos y refresca la presencia de los ya existentes. */
  abstract syncDiscoveredDevices(devices: DiscoveredDevice[]): Observable<NetworkDevice[]>;
  abstract setTrust(deviceId: string, trust: DeviceTrust): Observable<void>;
}
