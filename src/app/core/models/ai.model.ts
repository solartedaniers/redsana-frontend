/** Estado de la IA que da el backend; "warming_up" es un servicio dormido despertando, nunca un error. */
export type AiAvailability = 'ready' | 'warming_up' | 'unavailable';

/** Por qué la IA quedó no disponible: se agotó la espera o el servicio respondió con un problema. */
export type AiUnavailableReason = 'timed_out' | 'service_error';

/** Lo que responde el backend; reason solo viene cuando status es "unavailable" (los backends anteriores no lo envían). */
export interface AiStatusReport {
  readonly status: AiAvailability;
  readonly reason?: AiUnavailableReason | null;
}
