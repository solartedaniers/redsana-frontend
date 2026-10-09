import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY, filter, map } from 'rxjs';

/**
 * Solo aviso que hay versión nueva; recargar lo decide el usuario para no perder
 * un formulario o un chat a medio escribir. En escritorio el SW está apagado.
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
