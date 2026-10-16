import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Desplazamientos del chat: dejar una pregunta arriba de la lista sin mover la página, y traer el chat a la vista. */
@Injectable({ providedIn: 'root' })
export class ChatScrollAnchor {
  private readonly window = inject(DOCUMENT).defaultView;

  /** Solo se mueve la lista (la página no): la pregunta queda arriba y la respuesta empieza justo debajo. */
  showAtTop(list: HTMLElement, item: HTMLElement): void {
    const listPaddingTop = parseFloat(this.window?.getComputedStyle(list).paddingTop ?? '') || 0;
    list.scrollTo({ top: Math.max(0, item.offsetTop - listPaddingTop), behavior: this.behavior() });
  }

  bringIntoView(element: HTMLElement): void {
    element.scrollIntoView({ block: 'center', behavior: this.behavior() });
  }

  private behavior(): ScrollBehavior {
    return this.window?.matchMedia?.(REDUCED_MOTION_QUERY).matches ? 'auto' : 'smooth';
  }
}
