import { Injectable, InjectionToken, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AI_CLIENT_WAKE_UP_TIMEOUT_MS } from './ai-status.config';

/** /health público del servicio de IA; vacío si AI_SERVICE_PUBLIC_URL no está definida. */
export const AI_SERVICE_HEALTH_URL = new InjectionToken<string>('AI_SERVICE_HEALTH_URL', {
  providedIn: 'root',
  factory: () => (environment.aiServicePublicUrl ? `${environment.aiServicePublicUrl}/health` : ''),
});

// Un GET del navegador despierta a la IA de Render más rápido que el calentamiento del backend. Solo ante una acción
// del usuario, nunca en segundo plano; silencioso (no-cors, errores ignorados).
@Injectable({ providedIn: 'root' })
export class AiClientWakeUp {
  private readonly healthUrl = inject(AI_SERVICE_HEALTH_URL);

  wakeUp(): void {
    if (!this.healthUrl || typeof fetch !== 'function') {
      return;
    }
    fetch(this.healthUrl, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(AI_CLIENT_WAKE_UP_TIMEOUT_MS) })
      .catch(() => undefined);
  }
}
