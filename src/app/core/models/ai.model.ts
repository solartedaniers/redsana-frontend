/** Estado de la IA que da el backend; "warming_up" es un servicio dormido despertando, nunca un error. */
export type AiAvailability = 'ready' | 'warming_up' | 'unavailable';
