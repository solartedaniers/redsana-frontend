import { Injectable } from '@angular/core';
import { isTauri } from '@tauri-apps/api/core';

/**
 * Única fuente de verdad sobre dónde corre la app (escritorio Tauri o
 * navegador). Se evalúa una sola vez: el entorno no cambia en caliente.
 */
@Injectable({ providedIn: 'root' })
export class RuntimeEnvironmentService {
  readonly isDesktop = isTauri();
}
