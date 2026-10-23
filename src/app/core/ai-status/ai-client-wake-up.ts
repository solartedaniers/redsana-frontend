import { Injectable, InjectionToken, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AI_CLIENT_WAKE_UP_TIMEOUT_MS } from './ai-status.config';

/** /health público del servicio de IA; vacío si AI_SERVICE_PUBLIC_URL no está definida. */
export const AI_SERVICE_HEALTH_URL = new InjectionToken<string>('AI_SERVICE_HEALTH_URL', {
  providedIn: 'root',
  factory: () => (environment.aiServicePublicUrl ? `${environment.aiServicePublicUrl}/health` : ''),
});

/**
 * Un GET desde el navegador despierta en segundos al servicio de IA dormido en Render, cosa que el calentamiento del
 * backend no siempre logra. Se suma a ese calentamiento: solo se dispara cuando el usuario lo pide (sesión, chat,
 * reintentar), nunca en segundo plano. Silencioso: la respuesta no se lee (no-cors) y los errores se ignoran.
 */
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
