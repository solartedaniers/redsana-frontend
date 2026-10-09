/** Cifrado WiFi real que detecta el sistema operativo; va aparte porque no habla con la API. */
export abstract class WifiEncryptionGateway {
  /** false donde no se expone el cifrado (navegador); distingue "no se puede" de "falló la detección". */
  abstract readonly isAvailable: boolean;

  /** null cuando la detección falla (sin WiFi, fuera de Tauri o netsh sin el campo esperado). */
  abstract detect(): Promise<string | null>;
}
