import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, exhaustMap, from, interval, startWith, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { MeasurementDelivery } from '../pending-measurements/measurement-delivery';
import { NetworkMeasurementGateway } from './network-measurement.gateway';
import { NetworkIdentityGateway } from '../network-identity/network-identity.gateway';
import { MEASUREMENT_CONFIG } from '../domain/measurement-freshness';

const MEASUREMENT_INTERVAL_MS = MEASUREMENT_CONFIG.intervalMs;
/** Candado entre pestañas (Web Locks): sin él, cada pestaña guardaba su medición y sesgaba la calibración. */
const MEASUREMENT_LOCK_NAME = 'redsana-network-measurement';

// exhaustMap evita que dos ciclos se pisen (si uno tarda, el siguiente tic se salta) y catchError por ciclo evita que un
// fallo mate la suscripción.
@Injectable({ providedIn: 'root' })
export class NetworkMeasurementService {
  private readonly gateway = inject(NetworkMeasurementGateway);
  private readonly delivery = inject(MeasurementDelivery);
  private readonly networkIdentity = inject(NetworkIdentityGateway);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Las mediciones van a nombre del usuario: sin sesión no hay a quién atribuirlas.
  private readonly auth = inject(AuthService);
  private readonly isAuthenticated$ = toObservable(this.auth.isAuthenticated);

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
          isAuthenticated ? interval(MEASUREMENT_INTERVAL_MS).pipe(startWith(0)) : EMPTY,
        ),
        exhaustMap(() => this.runCycle()),
      )
      .subscribe();
  }

  private runCycle() {
    const ownerId = this.auth.currentUser()?.id;
    if (!ownerId) {
      return EMPTY;
    }
    // La hora se fija al empezar a medir: es la que el backend guarda aunque la medición llegue tarde.
    const recordedAt = new Date().toISOString();
    // Identifico la red en cada ciclo: si el equipo cambió de red, la medición cuenta para la nueva.
    return from(Promise.all([this.gateway.measure(), this.networkIdentity.currentNetworkFingerprint()])).pipe(
      switchMap(([measurement, fingerprint]) =>
        this.delivery.deliver({
          ownerId,
          recordedAt,
          measurement,
          source: this.gateway.source,
          networkFingerprint: fingerprint,
        }),
      ),
      catchError((error) => {
        console.error('No se pudo registrar la medición de red', error);
        return EMPTY;
      }),
    );
  }
}
