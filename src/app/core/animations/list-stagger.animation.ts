import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { MOTION_DURATION, MOTION_EASING } from './motion.constants';

// Aparición escalonada de items nuevos en listas (centro de alertas, tablas).
// Discreta a propósito: solo opacidad + una traslación mínima.
export const listStaggerAnimation = trigger('listStagger', [
  transition(':increment', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(-6px)' }),
      stagger(60, animate(`${MOTION_DURATION.slow} ${MOTION_EASING.decelerate}`, style({ opacity: 1, transform: 'translateY(0)' }))),
    ], { optional: true }),
  ]),
]);
