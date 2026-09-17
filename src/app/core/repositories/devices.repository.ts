import { Observable } from 'rxjs';
import { DeviceTrust, NetworkDevice } from '../models/device.model';

export abstract class DevicesRepository {
  abstract getDevices(householdId?: string): Observable<NetworkDevice[]>;
  /** Simula un escaneo activo de la red; puede tardar más que una lectura normal. */
  abstract scanForIntruders(householdId?: string): Observable<NetworkDevice[]>;
  abstract setTrust(deviceId: string, trust: DeviceTrust): Observable<void>;
}
