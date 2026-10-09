import { Injectable } from '@angular/core';
import { isTauri } from '@tauri-apps/api/core';

/** Dónde corre la app (escritorio Tauri o navegador); se evalúa una vez porque no cambia en caliente. */
@Injectable({ providedIn: 'root' })
export class RuntimeEnvironmentService {
  readonly isDesktop = isTauri();
}
