import { DiscoveredDevice } from '../models/device.model';

/** Descubre los dispositivos reales de la LAN; va aparte porque habla con el sistema operativo, no con la API. */
export abstract class LanScanGateway {
  /** false donde no se puede escanear (navegador); scan() rechaza con UnavailableInEnvironmentError. */
  abstract readonly isAvailable: boolean;

  /** Aquí el fallo se propaga a propósito: tratarlo como lista vacía mostraría una red vacía como si fuera real.
   * manual: el usuario pidió revisar ahora, así que solo cuenta quien respondió en este escaneo. */
  abstract scan(manual?: boolean): Promise<DiscoveredDevice[]>;
}
