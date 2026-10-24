import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, Injector, PLATFORM_ID, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, filter, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { FALLBACK_NETWORK_STATUS_THRESHOLDS, NetworkStatusThresholds } from './network-thresholds.config';

interface BackendThresholds {
  latency_warning_ms: number;
  latency_critical_ms: number;
  packet_loss_warning_percent: number;
  packet_loss_critical_percent: number;
}

// Los umbrales vienen del backend, que calcula el estado de cada medición: así el gráfico colorea igual que el
// dashboard. Una vez por sesión; mientras tanto o si fallan, quedan los de respaldo.
@Injectable({ providedIn: 'root' })
export class NetworkThresholdsService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // La sesión se busca recién en start(): quien solo lee los umbrales (el gráfico) no arrastra la autenticación.
  private readonly injector = inject(Injector);
  private readonly url = `${environment.apiBaseUrl}/api/network-metrics/thresholds`;

  readonly thresholds = signal<NetworkStatusThresholds>(FALLBACK_NETWORK_STATUS_THRESHOLDS);

  start(): void {
    // Al prerenderizar no hay sesión ni red.
    if (!this.isBrowser) {
      return;
    }
    toObservable(this.injector.get(AuthService).isAuthenticated, { injector: this.injector })
      .pipe(
        filter(Boolean),
        // Un 404 (backend anterior), un 50x (dormido) o un error de red dejan el respaldo, sin reintentos ni avisos.
        switchMap(() => this.http.get<BackendThresholds>(this.url).pipe(catchError(() => EMPTY))),
        map((response) => toThresholds(response)),
        filter((thresholds): thresholds is NetworkStatusThresholds => thresholds !== null)
      )
      .subscribe((thresholds) => this.thresholds.set(thresholds));
  }
}

/** Solo acepta números ordenados (advertencia ≤ crítica); cualquier otra respuesta deja el respaldo. */
function toThresholds(response: BackendThresholds | null): NetworkStatusThresholds | null {
  const thresholds: NetworkStatusThresholds = {
    latencyWarningMs: response?.latency_warning_ms ?? NaN,
    latencyCriticalMs: response?.latency_critical_ms ?? NaN,
    packetLossWarningPercent: response?.packet_loss_warning_percent ?? NaN,
    packetLossCriticalPercent: response?.packet_loss_critical_percent ?? NaN,
  };
  const valid =
    Object.values(thresholds).every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0) &&
    thresholds.latencyWarningMs <= thresholds.latencyCriticalMs &&
    thresholds.packetLossWarningPercent <= thresholds.packetLossCriticalPercent;
  return valid ? thresholds : null;
}
