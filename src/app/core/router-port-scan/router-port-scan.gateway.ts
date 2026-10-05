/**
 * Puertos de riesgo abiertos en el router (puerta de enlace). Separado en su
 * propia abstracción por el mismo motivo que WifiEncryptionGateway: habla con
 * el sistema operativo (comando Tauri scan_router_open_ports), no con la API.
 */
export abstract class RouterPortScanGateway {
  /** false cuando el entorno (p. ej. navegador) no permite abrir conexiones TCP a la red local. */
  abstract readonly isAvailable: boolean;

  /** null si no se pudo escanear: nunca se confunde con [] (escaneado y sin puertos de riesgo). */
  abstract scanOpenPorts(): Promise<number[] | null>;
}
