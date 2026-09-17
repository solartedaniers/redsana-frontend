// Espejo en TypeScript de src/styles/_motion.scss para usar los mismos
// tiempos/curvas dentro de metadatos de @angular/animations (trigger/transition).
// Mantener los valores sincronizados manualmente entre ambos archivos.
export const MOTION_DURATION = {
  fast: '120ms',
  base: '200ms',
  slow: '320ms',
} as const;

export const MOTION_EASING = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;
