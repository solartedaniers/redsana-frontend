/** Huella de la red actual, para que las anomalías se aprendan por red; habla con el sistema operativo. */
export abstract class NetworkIdentityGateway {
  /** Hash de la red calculado en este equipo (el dato crudo nunca sale); null si no se puede identificar. */
  abstract currentNetworkFingerprint(): Promise<string | null>;
}
