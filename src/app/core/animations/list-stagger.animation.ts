import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { MOTION_DURATION, MOTION_EASING } from './motion.constants';

// Entrada escalonada y discreta: solo opacidad y un desplazamiento mínimo.
export const listStaggerAnimation = trigger('listStagger', [
  transition(':increment', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(-6px)' }),
      stagger(60, animate(`${MOTION_DURATION.slow} ${MOTION_EASING.decelerate}`, style({ opacity: 1, transform: 'translateY(0)' }))),
    ], { optional: true }),
  ]),
]);
