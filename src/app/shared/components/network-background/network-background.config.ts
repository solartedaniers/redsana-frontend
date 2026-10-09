// Ajustes del fondo 3D de las pantallas públicas. Las velocidades van por segundo, no por cuadro.
export const NETWORK_BACKGROUND_CONFIG = {
  scene: {
    nodeCount: 64,
    nodeRadius: 0.8,
    hubRadius: 4.2,
    // FOV estrecho y cámara lejana: con ángulos amplios los nodos del borde se veían ovalados.
    cameraFov: 35,
    cameraZ: 125,
    maxPixelRatio: 1.5,
    // Los nodos viven en un cascarón esférico y dejan libre el centro para la tarjeta.
    shellRadiusMin: 26,
    shellRadiusSpan: 38,
    shellSquashY: 0.65,
    shellSquashZ: 0.8,
    connectDistance: 26,
    hubConnectDistance: 40,
    // Cada n nodos uno puede unirse al centro.
    hubLinkEvery: 3,
    lineOpacity: 0.22,
    ringCount: 3,
    ringBaseRadius: 11,
    ringGap: 13,
    ringThickness: 0.35,
    ringBaseOpacity: 0.22,
    ringOpacityStep: 0.06,
    ringTilt: Math.PI / 2.3,
  },
  motion: {
    // Toda la constelación: un giro muy lento y un leve cabeceo.
    spinY: 0.012,
    wobbleX: 0.008,
    wobbleXAmplitude: 0.1,
    hubSpinX: 0.06,
    hubSpinY: 0.09,
    // Latido del centro: ciclos por segundo y amplitud de escala.
    hubPulseRate: 0.7,
    hubPulseAmplitude: 0.06,
    nodeDriftSpeedMin: 0.05,
    nodeDriftSpeedSpan: 0.15,
    nodeDriftY: 1.6,
    nodeDriftX: 1,
    ringSpin: 0.015,
    ringSpinStep: 0.01,
    ringBreathRate: 0.06,
    ringBreathSpan: 1.5,
    ringBreathScale: 0.2,
    // Las conexiones son O(n²): las recalculo cada n cuadros, no en todos.
    connectionRefreshFrames: 6,
    // Delta máximo por cuadro (s): evita un salto después de una pausa larga.
    maxFrameDelta: 0.1,
  },
  parallax: {
    // Rotación extra máxima (rad) cuando el cursor llega al borde.
    strength: 0.32,
    // Fracción de la distancia que se recorre en cada cuadro (factor del lerp).
    lerp: 0.035,
    // En táctil no hay cursor: solo una deriva lenta automática.
    touchDriftRate: 0.03,
    touchDriftAmplitude: 0.12,
  },
} as const;
