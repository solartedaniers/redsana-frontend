import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, Injector, PLATFORM_ID, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, filter, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { FALLBACK_SECURITY_SCORE_CONFIG, SecurityScoreConfig } from './security-score-config.config';

interface BackendScoreConfig {
  good_min: number;
  warning_min: number;
  questionnaire_weight_percent: number;
  technical_weight_percent: number;
}

// Los rangos y pesos vienen del backend, que calcula el puntaje: así el medidor pinta con sus mismos criterios.
// Una vez por sesión; mientras tanto o si fallan, quedan los de respaldo. Mismo esquema que NetworkThresholdsService.
@Injectable({ providedIn: 'root' })
export class SecurityScoreConfigService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly injector = inject(Injector);
  private readonly url = `${environment.apiBaseUrl}/api/security-assessments/score-config`;

  readonly config = signal<SecurityScoreConfig>(FALLBACK_SECURITY_SCORE_CONFIG);

  start(): void {
    if (!this.isBrowser) {
      return;
    }
    toObservable(this.injector.get(AuthService).isAuthenticated, { injector: this.injector })
      .pipe(
        filter(Boolean),
        // Un 404 (backend anterior), un 50x (dormido) o un error de red dejan el respaldo, sin reintentos ni avisos.
        switchMap(() => this.http.get<BackendScoreConfig>(this.url).pipe(catchError(() => EMPTY))),
        map((response) => toConfig(response)),
        filter((config): config is SecurityScoreConfig => config !== null),
      )
      .subscribe((config) => this.config.set(config));
  }
}

/** Solo acepta rangos ordenados dentro de 0–100 y pesos que suman 100; cualquier otra respuesta deja el respaldo. */
function toConfig(response: BackendScoreConfig | null): SecurityScoreConfig | null {
  const config: SecurityScoreConfig = {
    goodMin: response?.good_min ?? NaN,
    warningMin: response?.warning_min ?? NaN,
    questionnaireWeightPercent: response?.questionnaire_weight_percent ?? NaN,
    technicalWeightPercent: response?.technical_weight_percent ?? NaN,
  };
  const valid =
    Object.values(config).every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0) &&
    0 < config.warningMin &&
    config.warningMin <= config.goodMin &&
    config.goodMin <= 100 &&
    config.questionnaireWeightPercent + config.technicalWeightPercent === 100;
  return valid ? config : null;
}
