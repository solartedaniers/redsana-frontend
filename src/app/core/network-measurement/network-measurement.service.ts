import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, from, interval, startWith, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NetworkMetricsRepository } from '../repositories/network-metrics.repository';
import { NetworkMeasurementGateway } from './network-measurement.gateway';
import { NetworkIdentityGateway } from '../network-identity/network-identity.gateway';

/** Frecuencia de la medición real de red en segundo plano. */
const MEASUREMENT_INTERVAL_MS = 60000;

/**
 * Dispara la medición del gateway activo (Rust en escritorio, fetch
 * cronometrado en navegador) a intervalos y persiste cada snapshot en el
 * backend. En escritorio el trabajo pesado ocurre en Rust/el SO y en
 * navegador son awaits de red, nunca cómputo en el hilo de JS: interval +
 * switchMap solo orquesta, no bloquea ni satura el Event Loop; switchMap
 * además evita solapar ciclos si uno tarda más que el intervalo, y
 * catchError por ciclo evita que un fallo puntual (red caída) mate la
 * suscripción completa.
 */
@Injectable({ providedIn: 'root' })
export class NetworkMeasurementService {
  private readonly gateway = inject(NetworkMeasurementGateway);
  private readonly repository = inject(NetworkMetricsRepository);
  private readonly networkIdentity = inject(NetworkIdentityGateway);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Las mediciones se guardan a nombre del usuario: sin sesión no hay a quién
  // atribuirlas (el backend responde 401) y en la landing pública solo serían
  // tráfico inútil de cada visitante anónimo.
  private readonly isAuthenticated$ = toObservable(inject(AuthService).isAuthenticated);

  start(): void {
    // Al prerenderizar no hay red que medir, y un interval vivo impediría que
    // el prerender termine (la app nunca quedaría estable).
    if (!this.isBrowser) {
      return;
    }

    this.isAuthenticated$
      .pipe(
        // Al iniciar sesión mide de inmediato; al cerrarla, switchMap corta el ciclo.
        switchMap((isAuthenticated) =>
          isAuthenticated ? interval(MEASUREMENT_INTERVAL_MS).pipe(startWith(0)) : EMPTY
        ),
        switchMap(() => this.runCycle())
      )
      .subscribe();
  }

  private runCycle() {
    // La red se identifica en cada ciclo: si el equipo cambió de red, la
    // medición se cuenta para la red nueva (cada una calibra por separado).
    return from(Promise.all([this.gateway.measure(), this.networkIdentity.currentNetworkFingerprint()])).pipe(
      switchMap(([measurement, fingerprint]) => this.repository.record(measurement, this.gateway.source, fingerprint)),
      catchError((error) => {
        console.error('No se pudo registrar la medición de red', error);
        return EMPTY;
      })
    );
  }
}
