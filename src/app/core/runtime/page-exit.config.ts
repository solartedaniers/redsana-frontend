// WebKit cancela milisegundos después de beforeunload. Pasado este margen sin salir (p. ej. tras una descarga), un
// status 0 vuelve a contarse como error real.
export const PAGE_EXIT_CANCEL_WINDOW_MS = 1_000;
