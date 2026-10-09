import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, from, interval, startWith, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NetworkMetricsRepository } from '../repositories/network-metrics.repository';
import { NetworkMeasurementGateway } from './network-measurement.gateway';
import { NetworkIdentityGateway } from '../network-identity/network-identity.gateway';

/** Cada cuánto se mide la red en segundo plano. */
const MEASUREMENT_INTERVAL_MS = 60000;
/** Candado entre pestañas (Web Locks): sin él, cada pestaña guardaba su medición y sesgaba la calibración. */
const MEASUREMENT_LOCK_NAME = 'redsana-network-measurement';

/**
 * Mide a intervalos y guarda cada resultado sin bloquear el hilo de JS. switchMap evita
 * que dos ciclos se pisen y catchError por ciclo evita que un fallo mate la suscripción.
 */
@Injectable({ providedIn: 'root' })
export class NetworkMeasurementService {
  private readonly gateway = inject(NetworkMeasurementGateway);
  private readonly repository = inject(NetworkMetricsRepository);
  private readonly networkIdentity = inject(NetworkIdentityGateway);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Las mediciones van a nombre del usuario: sin sesión no hay a quién atribuirlas.
  private readonly isAuthenticated$ = toObservable(inject(AuthService).isAuthenticated);

  start(): void {
    // Al prerenderizar no hay red y un intervalo vivo no dejaría terminar el prerender.
    if (!this.isBrowser) {
      return;
    }

    // Solo mide la pestaña con el candado; las demás esperan y toman el relevo si se cierra. Sin Web Locks mido igual.
    const locks = globalThis.navigator?.locks;
    if (!locks) {
      this.measureWhileAuthenticated();
      return;
    }
    void locks.request(MEASUREMENT_LOCK_NAME, () => {
      this.measureWhileAuthenticated();
      // Esta promesa nunca se resuelve a propósito: así conservo el candado mientras viva la pestaña.
      return new Promise<never>(() => undefined);
    });
  }

  private measureWhileAuthenticated(): void {
    this.isAuthenticated$
      .pipe(
        // Al iniciar sesión mido enseguida; al cerrarla, switchMap corta el ciclo.
        switchMap((isAuthenticated) =>
          isAuthenticated ? interval(MEASUREMENT_INTERVAL_MS).pipe(startWith(0)) : EMPTY
        ),
        switchMap(() => this.runCycle())
      )
      .subscribe();
  }

  private runCycle() {
    // Identifico la red en cada ciclo: si el equipo cambió de red, la medición cuenta para la nueva.
    return from(Promise.all([this.gateway.measure(), this.networkIdentity.currentNetworkFingerprint()])).pipe(
      switchMap(([measurement, fingerprint]) => this.repository.record(measurement, this.gateway.source, fingerprint)),
      catchError((error) => {
        console.error('No se pudo registrar la medición de red', error);
        return EMPTY;
      })
    );
  }
}
