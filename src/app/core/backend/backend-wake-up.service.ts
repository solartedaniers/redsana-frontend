import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { EMPTY, catchError } from 'rxjs';
import { BACKEND_HEALTH_URL } from './backend-endpoints';

/**
 * Render apaga el backend gratuito tras un rato sin uso y tarda cerca de un minuto en volver. Lo despierto apenas se
 * abre el login, mientras el usuario escribe, para que iniciar sesión no cargue con esa espera.
 */
@Injectable({ providedIn: 'root' })
export class BackendWakeUpService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  wakeUp(): void {
    // Al prerenderizar no hay a quién despertar.
    if (!this.isBrowser) {
      return;
    }
    // Solo importa que la petición llegue: si falla, el login sigue funcionando igual y no muestro nada.
    this.http.get(BACKEND_HEALTH_URL).pipe(catchError(() => EMPTY)).subscribe();
  }
}
