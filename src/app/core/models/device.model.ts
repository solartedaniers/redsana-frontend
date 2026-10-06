export type DeviceTrust = 'trusted' | 'unknown' | 'blocked';
/** Papel en la red según el último escaneo: el router es la red misma y "this_device" es el equipo que escanea. */
export type DeviceNetworkRole = 'this_device' | 'gateway' | 'other';

export interface NetworkDevice {
  id: string;
  name: string;
  macAddress: string;
  ipAddress: string;
  trust: DeviceTrust;
  firstSeen: string;
  lastSeen: string;
  isOnline: boolean;
  /** null en dispositivos guardados antes de que el escaneo marcara el papel. */
  networkRole: DeviceNetworkRole | null;
}

/** Resultado crudo de un escaneo real de la LAN (Tauri/ARP), antes de sincronizar con el backend. */
export interface DiscoveredDevice {
  ip: string;
  mac: string;
  role: DeviceNetworkRole;
}
