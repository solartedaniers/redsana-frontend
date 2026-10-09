/** Puertos de riesgo abiertos en el router; va aparte porque habla con el sistema operativo, no con la API. */
export abstract class RouterPortScanGateway {
  /** false donde no se pueden abrir conexiones TCP a la red local (navegador). */
  abstract readonly isAvailable: boolean;

  /** null si no se pudo escanear, que no es lo mismo que [] (escaneado y sin puertos de riesgo). */
  abstract scanOpenPorts(): Promise<number[] | null>;
}
