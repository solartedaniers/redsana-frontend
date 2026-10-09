/** Se pidió una capacidad nativa donde no existe; lanzo error para no confundir "no se puede" con "no hay nada". */
export class UnavailableInEnvironmentError extends Error {
  override readonly name = 'UnavailableInEnvironmentError';
}
