export interface TopologyOffset {
  xRem: number;
  yRem: number;
}

// El primer anillo coincide con el círculo decorativo de .topology; los demás se abren solo si hacen falta.
const FIRST_RING_RADIUS_REM = 8.5;
const RING_STEP_REM = 2.2;
// Distancia mínima entre puntos vecinos de un anillo (punto más su halo) para que no se encimen.
const MIN_NODE_SPACING_REM = 1.7;

/** Una posición distinta por dispositivo: lleno cada anillo y el resto pasa a anillos exteriores. */
export function layoutTopologyNodes(count: number): TopologyOffset[] {
  const offsets: TopologyOffset[] = [];
  let radius = FIRST_RING_RADIUS_REM;
  while (offsets.length < count) {
    const capacity = Math.floor((2 * Math.PI * radius) / MIN_NODE_SPACING_REM);
    const nodesInRing = Math.min(capacity, count - offsets.length);
    for (let i = 0; i < nodesInRing; i++) {
      // Arranco arriba (-π/2), como las agujas del reloj.
      const angle = (2 * Math.PI * i) / nodesInRing - Math.PI / 2;
      offsets.push({ xRem: radius * Math.cos(angle), yRem: radius * Math.sin(angle) });
    }
    radius += RING_STEP_REM;
  }
  return offsets;
}
