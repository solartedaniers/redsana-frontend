import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, Injector, PLATFORM_ID, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, filter, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NetworkMeasurementGateway } from '../network-measurement/network-measurement.gateway';
import { RuntimeEnvironmentService } from '../runtime/runtime-environment.service';
import {
  FALLBACK_NETWORK_STATUS_THRESHOLDS,
  FALLBACK_ROUTER_DIAGNOSIS_LIMITS,
  NetworkStatusThresholds,
  RouterDiagnosisLimits,
} from './network-thresholds.config';

interface BackendThresholds {
  latency_warning_ms: number;
  latency_critical_ms: number;
  packet_loss_warning_percent: number;
  packet_loss_critical_percent: number;
  // Agregados después: un backend anterior no los manda.
  gateway_latency_bad_ms?: number | null;
  gateway_recent_reply_minutes?: number | null;
}

/** Lo que el escritorio guarda para diagnosticar sin conexión con los mismos umbrales del backend. */
interface StoredThresholds {
  thresholds: NetworkStatusThresholds;
  routerLimits: RouterDiagnosisLimits;
}

const STORAGE_KEY = 'redsana-network-thresholds';

// Los umbrales vienen del backend, que calcula el estado de cada medición: así el gráfico colorea igual que el
// dashboard. Se piden los de la fuente con que mide esta app (la web tiene su propia escala de latencia). Una vez por
// sesión; mientras tanto o si fallan, quedan los de respaldo. El escritorio guarda la última respuesta válida y arranca
// con ella: sin conexión diagnostica con la misma regla que el backend (ver diagnoseNetwork).
@Injectable({ providedIn: 'root' })
export class NetworkThresholdsService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // La sesión se busca recién en start(): quien solo lee los umbrales (el gráfico) no arrastra la autenticación.
  private readonly injector = inject(Injector);
  private readonly isDesktop = inject(RuntimeEnvironmentService).isDesktop;
  private readonly url = `${environment.apiBaseUrl}/api/network-metrics/thresholds`;
  private readonly stored = this.readStored();

  readonly thresholds = signal<NetworkStatusThresholds>(this.stored?.thresholds ?? FALLBACK_NETWORK_STATUS_THRESHOLDS);
  readonly routerLimits = signal<RouterDiagnosisLimits>(this.stored?.routerLimits ?? FALLBACK_ROUTER_DIAGNOSIS_LIMITS);

  start(): void {
    // Al prerenderizar no hay sesión ni red.
    if (!this.isBrowser) {
      return;
    }
    // Un backend anterior ignora source y responde los del escritorio, como antes.
    const params = { source: this.injector.get(NetworkMeasurementGateway).source };
    toObservable(this.injector.get(AuthService).isAuthenticated, { injector: this.injector })
      .pipe(
        filter(Boolean),
        // Un 404 (backend anterior), un 50x (dormido) o un error de red dejan el respaldo, sin reintentos ni avisos.
        switchMap(() => this.http.get<BackendThresholds>(this.url, { params }).pipe(catchError(() => EMPTY))),
      )
      .subscribe((response) => this.apply(response));
  }

  private apply(response: BackendThresholds | null): void {
    const thresholds = toThresholds(response);
    if (!thresholds) {
      return;
    }
    const routerLimits = toRouterLimits(response) ?? this.routerLimits();
    this.thresholds.set(thresholds);
    this.routerLimits.set(routerLimits);
    this.writeStored({ thresholds, routerLimits });
  }

  // Solo el escritorio: la web sigue pidiéndolos en cada sesión, como antes.
  private readStored(): StoredThresholds | null {
    if (!this.isDesktop || !this.isBrowser) {
      return null;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredThresholds | null;
      return stored && isValidThresholds(stored.thresholds) && isValidRouterLimits(stored.routerLimits) ? stored : null;
    } catch {
      return null;
    }
  }

  private writeStored(stored: StoredThresholds): void {
    if (!this.isDesktop) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (error) {
      console.warn('No se pudieron guardar los umbrales en el equipo', error);
    }
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
  return isValidThresholds(thresholds) ? thresholds : null;
}

/** null si el backend no los manda (anterior) o no son números positivos: quedan los que ya había. */
function toRouterLimits(response: BackendThresholds | null): RouterDiagnosisLimits | null {
  const limits: RouterDiagnosisLimits = {
    gatewayLatencyBadMs: response?.gateway_latency_bad_ms ?? NaN,
    gatewayRecentReplyMinutes: response?.gateway_recent_reply_minutes ?? NaN,
  };
  return isValidRouterLimits(limits) ? limits : null;
}

function isPositive(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidThresholds(thresholds: NetworkStatusThresholds | undefined): boolean {
  return (
    !!thresholds &&
    Object.values(thresholds).every(isPositive) &&
    thresholds.latencyWarningMs <= thresholds.latencyCriticalMs &&
    thresholds.packetLossWarningPercent <= thresholds.packetLossCriticalPercent
  );
}

function isValidRouterLimits(limits: RouterDiagnosisLimits | undefined): boolean {
  return !!limits && isPositive(limits.gatewayLatencyBadMs) && isPositive(limits.gatewayRecentReplyMinutes);
}
