export interface TopologyOffset {
  xRem: number;
  yRem: number;
}

// El primer anillo coincide con el círculo decorativo de .topology::before
// (17rem de diámetro); los siguientes se abren hacia afuera solo si hacen falta.
const FIRST_RING_RADIUS_REM = 8.5;
const RING_STEP_REM = 2.2;
// Distancia mínima entre centros de puntos vecinos de un mismo anillo
// (diámetro del punto + su halo), para que nunca se encimen.
const MIN_NODE_SPACING_REM = 1.7;

/**
 * Una posición por dispositivo, sin excepción: count puntos -> count offsets
 * distintos alrededor del hub. Llena cada anillo hasta su capacidad y reparte
 * el resto en anillos exteriores, con los puntos de cada anillo equiespaciados.
 */
export function layoutTopologyNodes(count: number): TopologyOffset[] {
  const offsets: TopologyOffset[] = [];
  let radius = FIRST_RING_RADIUS_REM;
  while (offsets.length < count) {
    const capacity = Math.floor((2 * Math.PI * radius) / MIN_NODE_SPACING_REM);
    const nodesInRing = Math.min(capacity, count - offsets.length);
    for (let i = 0; i < nodesInRing; i++) {
      // -π/2: el primer punto arranca arriba, como una lectura de reloj.
      const angle = (2 * Math.PI * i) / nodesInRing - Math.PI / 2;
      offsets.push({ xRem: radius * Math.cos(angle), yRem: radius * Math.sin(angle) });
    }
    radius += RING_STEP_REM;
  }
  return offsets;
}
