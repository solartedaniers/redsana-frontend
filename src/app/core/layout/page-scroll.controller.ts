import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

// Para vistas a pantalla completa (el chat ampliado): sube la página para que se vea la barra superior y bloquea el
// scroll de fondo hasta que se cierre.
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
