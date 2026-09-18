import { Injectable, inject } from '@angular/core';
import { isTauri } from '@tauri-apps/api/core';
import { EMPTY, catchError, from, interval, startWith, switchMap } from 'rxjs';
import { NetworkMetricsRepository } from '../repositories/network-metrics.repository';
import { NetworkMeasurementGateway } from './network-measurement.gateway';

/** Frecuencia de la medición real de red en segundo plano. */
const MEASUREMENT_INTERVAL_MS = 60000;

/**
 * Dispara measure_network_quality (Rust) a intervalos y persiste cada
 * snapshot en el backend. El trabajo pesado ocurre en Rust/el SO, no en el
 * hilo de JS: interval + switchMap solo orquesta, no bloquea ni satura el
 * Event Loop; switchMap además evita solapar ciclos si uno tarda más que
 * el intervalo, y catchError por ciclo evita que un fallo puntual (red caída)
 * mate la suscripción completa.
 */
@Injectable({ providedIn: 'root' })
export class NetworkMeasurementService {
  private readonly gateway = inject(NetworkMeasurementGateway);
  private readonly repository = inject(NetworkMetricsRepository);

  start(): void {
    // Fuera de Tauri (p. ej. ng serve en el navegador) no hay comando que invocar.
    if (!isTauri()) {
      return;
    }

    interval(MEASUREMENT_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.runCycle())
      )
      .subscribe();
  }

  private runCycle() {
    return from(this.gateway.measure()).pipe(
      switchMap((measurement) => this.repository.record(measurement)),
      catchError((error) => {
        console.error('No se pudo registrar la medición de red', error);
        return EMPTY;
      })
    );
  }
}
