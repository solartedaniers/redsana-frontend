// Geometría y límites de densidad del ECG de latencia (unidades del SVG).
export const HISTORY_CHART_CONFIG = {
  viewBoxWidth: 600,
  viewBoxHeight: 160,
  // Espacio libre sobre el valor más alto, como factor de ese valor.
  headroom: 1.25,
  // Agrupo los historiales largos (conservando el pico de cada grupo) para que el SVG siga liviano.
  maxTracePoints: 240,
  heatmapCells: 48,
  // Solo marco los picos más altos (y siempre los cortes) para que una red degradada no se llene de puntos.
  maxPeakMarkers: 3,
} as const;
