import { Injectable, Injector, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { invoke } from '@tauri-apps/api/core';
import { delay, filter } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SESSION_RESTORE_CONFIG } from '../auth/session-restore.config';

/**
 * Solo escritorio (se carga aparte). Si Windows abrió la app al iniciar sesión, el WiFi suele tardar en conectarse:
 * en vez de quedarse en la pantalla de fallo esperando que alguien pulse "Reintentar" (la ventana está oculta en la
 * bandeja), vuelve a intentar la sesión sola hasta lograrlo; con la sesión, la medición arranca sola.
 */
@Injectable({ providedIn: 'root' })
export class AutostartSessionRetry {
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  constructor() {
    invoke<boolean>('is_autostart_launch')
      .then((autostart) => autostart && this.keepRetrying())
      .catch((error: unknown) => console.error('No se pudo saber si la abrió Windows', error));
  }

  private keepRetrying(): void {
    toObservable(this.auth.restoreState, { injector: this.injector })
      .pipe(
        filter((state) => state === 'failed'),
        delay(SESSION_RESTORE_CONFIG.retryDelayMs),
      )
      .subscribe(() => this.auth.retryRestore());
  }
}
