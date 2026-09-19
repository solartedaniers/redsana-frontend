/**
 * Fuente del cifrado WiFi real detectado por el SO. Hoy la resuelve el comando
 * Tauri get_wifi_encryption; separado en su propia abstracción por el mismo
 * motivo que NetworkMeasurementGateway (habla con el sistema operativo, no con
 * la API del backend).
 */
export abstract class WifiEncryptionGateway {
  /** null cuando la detección falla (sin WiFi, fuera de Tauri, netsh sin el campo esperado). */
  abstract detect(): Promise<string | null>;
}
