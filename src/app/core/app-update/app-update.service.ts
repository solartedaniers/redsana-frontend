import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY, filter, map } from 'rxjs';

/**
 * El Service Worker sirve la versión cacheada y baja la nueva en segundo plano:
 * sin esto, tras un deploy el usuario seguía con la versión vieja hasta volver
 * a abrir la app. Aquí solo se avisa; recargar lo decide el usuario para no
 * perder un formulario o un chat a medio escribir. En escritorio (SW
 * desactivado) isEnabled es false y nunca hay aviso.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);

  readonly isUpdateReady = toSignal(
    this.swUpdate.isEnabled
      ? this.swUpdate.versionUpdates.pipe(
          filter((event) => event.type === 'VERSION_READY'),
          map(() => true)
        )
      : EMPTY,
    { initialValue: false }
  );

  /** La versión nueva ya está descargada: recargar la activa. */
  applyUpdate(): void {
    this.document.location.reload();
  }
}
