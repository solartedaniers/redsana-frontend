import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { PAGE_EXIT_CANCEL_WINDOW_MS } from './page-exit.config';

// beforeunload no garantiza la salida (una descarga lo dispara y la página sigue), por eso solo cuenta un momento;
// pagehide sí es definitivo y pageshow lo deshace al volver desde la caché del navegador.
@Injectable({ providedIn: 'root' })
export class PageExitService {
  private leavingUntil = 0;
  private hidden = false;

  constructor() {
    // Al prerenderizar no hay ventana.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      window.addEventListener('beforeunload', () => (this.leavingUntil = Date.now() + PAGE_EXIT_CANCEL_WINDOW_MS));
      window.addEventListener('pagehide', () => (this.hidden = true));
      window.addEventListener('pageshow', () => {
        this.hidden = false;
        this.leavingUntil = 0;
      });
    }
  }

  isLeaving(): boolean {
    return this.hidden || Date.now() < this.leavingUntil;
  }
}
