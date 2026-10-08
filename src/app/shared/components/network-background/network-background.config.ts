// Tuning knobs of the public-screens 3D background. Speeds are in radians (or
// world units) per second, so the motion is identical at any frame rate.
export const NETWORK_BACKGROUND_CONFIG = {
  scene: {
    nodeCount: 64,
    nodeRadius: 0.8,
    hubRadius: 4.2,
    // Narrow FOV + farther camera: wide angles stretched edge nodes into ovals.
    cameraFov: 35,
    cameraZ: 125,
    maxPixelRatio: 1.5,
    // Nodes live on a spherical shell, leaving the center clear for the card.
    shellRadiusMin: 26,
    shellRadiusSpan: 38,
    shellSquashY: 0.65,
    shellSquashZ: 0.8,
    connectDistance: 26,
    hubConnectDistance: 40,
    // Every n-th node may link to the hub.
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
    // Whole constellation: a very slow turn plus a gentle nod.
    spinY: 0.012,
    wobbleX: 0.008,
    wobbleXAmplitude: 0.1,
    hubSpinX: 0.06,
    hubSpinY: 0.09,
    // Hub "heartbeat": cycles per second and scale amplitude.
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
    // Connections are O(n²): recomputed every n frames, not every frame.
    connectionRefreshFrames: 6,
    // Longest frame delta accepted (s): avoids a jump after a long stall.
    maxFrameDelta: 0.1,
  },
  parallax: {
    // Max extra rotation (rad) when the cursor reaches the viewport edge.
    strength: 0.32,
    // Fraction of the remaining distance covered per frame (lerp factor).
    lerp: 0.035,
    // Touch screens: no cursor, only a slow automatic drift.
    touchDriftRate: 0.03,
    touchDriftAmplitude: 0.12,
  },
} as const;
