// WebKit cancela las peticiones en vuelo apenas empieza la navegación, unos milisegundos después de beforeunload y
// antes de pagehide. Pasado este margen sin que la página se vaya (p. ej. el botón de descarga, que navega al
// instalador y la página sigue abierta), un status 0 vuelve a contarse como error real.
export const PAGE_EXIT_CANCEL_WINDOW_MS = 1_000;
