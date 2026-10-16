import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Controla el scroll de la página completa. Lo usa una vista que ocupa la pantalla (el chat ampliado): la llevo arriba
 * para que la barra superior quede visible y bloqueo el scroll de fondo hasta que la vista se cierre.
 */
@Injectable({ providedIn: 'root' })
export class PageScrollController {
  private readonly document = inject(DOCUMENT);
  private previousOverflow: string | null = null;

  get isLocked(): boolean {
    return this.previousOverflow !== null;
  }

  lockAtTop(): void {
    if (this.isLocked) {
      return;
    }
    this.document.defaultView?.scrollTo({ top: 0, left: 0 });
    const root = this.document.documentElement;
    this.previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
  }

  unlock(): void {
    if (this.previousOverflow === null) {
      return;
    }
    this.document.documentElement.style.overflow = this.previousOverflow;
    this.previousOverflow = null;
  }
}
