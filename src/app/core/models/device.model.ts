export type DeviceTrust = 'trusted' | 'unknown' | 'blocked';

export interface NetworkDevice {
  id: string;
  name: string;
  macAddress: string;
  ipAddress: string;
  trust: DeviceTrust;
  firstSeen: string;
  lastSeen: string;
}
