import { DiscoveredDevice } from '../models/device.model';

/**
 * Descubrimiento real de dispositivos en la LAN local. Hoy lo resuelve el
 * comando Tauri scan_connected_devices (barrido ARP); separado en su propia
 * abstracción por el mismo motivo que WifiEncryptionGateway: habla con el
 * sistema operativo, no con la API del backend.
 */
export abstract class LanScanGateway {
  /** false cuando el entorno (p. ej. navegador) no permite escanear la LAN; scan() rechaza con UnavailableInEnvironmentError. */
  abstract readonly isAvailable: boolean;

  /**
   * A diferencia de WifiEncryptionGateway, un fallo aquí se propaga en vez de
   * resolver a una lista vacía: tratar un escaneo fallido como "no se
   * encontraron dispositivos" mostraría una red vacía como si fuera real.
   */
  abstract scan(): Promise<DiscoveredDevice[]>;
}
