// Geometry and density limits of the latency ECG chart (SVG user units).
export const HISTORY_CHART_CONFIG = {
  viewBoxWidth: 600,
  viewBoxHeight: 160,
  // Empty space above the highest value, as a factor of that value.
  headroom: 1.25,
  // Long histories are bucketed (keeping each bucket's peak) so the SVG stays
  // light on phones and in WebView2 no matter how many samples exist.
  maxTracePoints: 240,
  heatmapCells: 48,
  // Only the highest threshold peaks get a marker (outages always do), so a
  // network that is degraded all day does not turn into a wall of dots.
  maxPeakMarkers: 3,
} as const;
