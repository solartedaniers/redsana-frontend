import { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map } from 'rxjs';
import { MEASUREMENT_CONFIG } from '../domain/measurement-freshness';

// Avanza una vez por ciclo para que "en vivo" se apague solo si dejan de llegar datos.
export function injectMeasurementClock(): Signal<number> {
  return toSignal(interval(MEASUREMENT_CONFIG.intervalMs).pipe(map(() => Date.now())), { initialValue: Date.now() });
}
