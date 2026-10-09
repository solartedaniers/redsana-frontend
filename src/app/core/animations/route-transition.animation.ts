import { animate, group, query, style, transition, trigger } from '@angular/animations';
import { MOTION_DURATION, MOTION_EASING } from './motion.constants';

// Fundido entre vistas; va en el contenedor del <router-outlet> de cada layout, no en cada página.
export const routeTransitionAnimation = trigger('routeTransition', [
  transition('* <=> *', [
    style({ position: 'relative' }),
    query(':enter, :leave', style({ position: 'absolute', inset: 0, width: '100%' }), {
      optional: true,
    }),
    query(':enter', style({ opacity: 0 }), { optional: true }),
    group([
      query(
        ':leave',
        animate(`${MOTION_DURATION.base} ${MOTION_EASING.accelerate}`, style({ opacity: 0 })),
        { optional: true }
      ),
      query(
        ':enter',
        animate(`${MOTION_DURATION.base} ${MOTION_EASING.decelerate}`, style({ opacity: 1 })),
        { optional: true }
      ),
    ]),
  ]),
]);
