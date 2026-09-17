import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'redsana-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.readInitialMode());

  constructor() {
    // El effect aplica el atributo cada vez que `mode` cambia, incluyendo
    // el valor inicial leído de localStorage/preferencia del sistema.
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.mode());
      localStorage.setItem(STORAGE_KEY, this.mode());
    });
  }

  toggle(): void {
    this.mode.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private readInitialMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Sin preferencia guardada: respeta el modo oscuro del sistema operativo,
    // pero el oscuro es el default de marca para RedSana (panel tipo NOC).
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }
}
