export const LOCAL_DIAGNOSIS_CONFIG = {
  /**
   * El dashboard consulta el servidor cada 4 s: si lleva este tiempo sin responder y hay una medición del equipo más
   * nueva que la última respuesta, el panel muestra el diagnóstico hecho en el equipo.
   */
  serverSilentAfterMs: 15_000,
} as const;
