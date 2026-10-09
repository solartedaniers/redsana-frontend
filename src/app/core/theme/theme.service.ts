import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'redsana-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly mode = signal<ThemeMode>(this.readInitialMode());

  constructor() {
    // El effect aplica el atributo en cada cambio de modo, incluido el valor inicial.
    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.mode());
      if (this.isBrowser) {
        localStorage.setItem(STORAGE_KEY, this.mode());
      }
    });
  }

  toggle(): void {
    this.mode.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private readInitialMode(): ThemeMode {
    // Al prerenderizar no hay preferencia del usuario, así que uso el tema de marca.
    if (!this.isBrowser) {
      return 'dark';
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Sin preferencia guardada sigo al sistema operativo; si no dice nada, oscuro como marca.
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }
}
