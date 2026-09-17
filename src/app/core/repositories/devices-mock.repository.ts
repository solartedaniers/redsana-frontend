import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { DevicesRepository } from './devices.repository';
import { DeviceTrust, NetworkDevice } from '../models/device.model';

const SIMULATED_LATENCY_MS = 300;
const SCAN_DURATION_MS = 2200;

@Injectable()
export class MockDevicesRepository extends DevicesRepository {
  private devices: NetworkDevice[] = [
    {
      id: 'device-1',
      name: 'iPhone de Ana',
      macAddress: 'A4:5E:60:11:22:33',
      ipAddress: '192.168.1.12',
      trust: 'trusted',
      firstSeen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      lastSeen: new Date().toISOString(),
    },
    {
      id: 'device-2',
      name: 'Smart TV Sala',
      macAddress: 'B8:27:EB:44:55:66',
      ipAddress: '192.168.1.20',
      trust: 'trusted',
      firstSeen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString(),
      lastSeen: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: 'device-3',
      name: 'Dispositivo desconocido',
      macAddress: 'DC:A6:32:77:88:99',
      ipAddress: '192.168.1.47',
      trust: 'unknown',
      firstSeen: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      lastSeen: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    },
  ];

  getDevices(): Observable<NetworkDevice[]> {
    return of([...this.devices]).pipe(delay(SIMULATED_LATENCY_MS));
  }

  scanForIntruders(): Observable<NetworkDevice[]> {
    // El escaneo "encuentra" el dispositivo desconocido ya sembrado, para que
    // la pantalla tenga algo real que mostrar como hallazgo de intrusión.
    const findings = this.devices.filter((device) => device.trust !== 'trusted');
    return of(findings).pipe(delay(SCAN_DURATION_MS));
  }

  setTrust(deviceId: string, trust: DeviceTrust): Observable<void> {
    this.devices = this.devices.map((device) =>
      device.id === deviceId ? { ...device, trust } : device
    );
    return of(undefined).pipe(delay(150));
  }
}
