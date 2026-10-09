import { Observable } from 'rxjs';
import { DeviceTrust, DiscoveredDevice, NetworkDevice } from '../models/device.model';

export abstract class DevicesRepository {
  abstract getDevices(householdId?: string): Observable<NetworkDevice[]>;
  /** Sincroniza lo que encontró un escaneo real: crea los nuevos y refresca la presencia de los conocidos. */
  abstract syncDiscoveredDevices(devices: DiscoveredDevice[]): Observable<NetworkDevice[]>;
  abstract setTrust(deviceId: string, trust: DeviceTrust): Observable<void>;
}
