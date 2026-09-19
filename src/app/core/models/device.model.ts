export type DeviceTrust = 'trusted' | 'unknown' | 'blocked';

export interface NetworkDevice {
  id: string;
  name: string;
  macAddress: string;
  ipAddress: string;
  trust: DeviceTrust;
  firstSeen: string;
  lastSeen: string;
  isOnline: boolean;
}

/** Resultado crudo de un escaneo real de la LAN (Tauri/ARP), antes de sincronizar con el backend. */
export interface DiscoveredDevice {
  ip: string;
  mac: string;
}
