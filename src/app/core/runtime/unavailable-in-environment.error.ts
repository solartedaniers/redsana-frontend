/**
 * Una capacidad nativa (ARP, cifrado WiFi) se pidió en un entorno que no la
 * expone. Se lanza en vez de devolver un resultado vacío para que nunca se
 * confunda "no se puede medir aquí" con "se midió y no hay nada".
 */
export class UnavailableInEnvironmentError extends Error {
  override readonly name = 'UnavailableInEnvironmentError';
}
