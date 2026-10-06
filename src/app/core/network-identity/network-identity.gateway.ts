/**
 * Huella de la red a la que está conectado el equipo, para que la detección de
 * anomalías aprenda cada red por separado. Separado en su propia abstracción
 * por el mismo motivo que LanScanGateway: habla con el sistema operativo.
 */
export abstract class NetworkIdentityGateway {
  /**
   * SHA-256 (hex) del identificador de la red, calculado en este equipo: el
   * dato crudo nunca se envía. null si no se puede identificar (navegador, sin
   * red, router no resuelto): esa medición no se asigna a ninguna red.
   */
  abstract currentNetworkFingerprint(): Promise<string | null>;
}
