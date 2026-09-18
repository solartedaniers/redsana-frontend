import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DeviceTrust, NetworkDevice } from '../models/device.model';
import { DevicesRepository } from './devices.repository';

interface BackendDevice {
  id: string;
  name: string;
  mac_address: string;
  ip_address: string;
  trust: DeviceTrust;
  first_seen: string;
  last_seen: string;
}

@Injectable()
export class DevicesHttpRepository extends DevicesRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/devices`;

  getDevices(): Observable<NetworkDevice[]> {
    return this.http.get<BackendDevice[]>(this.baseUrl).pipe(map((devices) => devices.map(this.toNetworkDevice)));
  }

  scanForIntruders(): Observable<NetworkDevice[]> {
    return this.http
      .post<BackendDevice[]>(`${this.baseUrl}/scan`, {})
      .pipe(map((devices) => devices.map(this.toNetworkDevice)));
  }

  setTrust(deviceId: string, trust: DeviceTrust): Observable<void> {
    return this.http.patch<BackendDevice>(`${this.baseUrl}/${deviceId}`, { trust }).pipe(map(() => undefined));
  }

  private toNetworkDevice(device: BackendDevice): NetworkDevice {
    return {
      id: device.id,
      name: device.name,
      macAddress: device.mac_address,
      ipAddress: device.ip_address,
      trust: device.trust,
      firstSeen: device.first_seen,
      lastSeen: device.last_seen,
    };
  }
}
