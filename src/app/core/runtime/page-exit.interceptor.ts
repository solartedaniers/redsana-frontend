import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NEVER, catchError, throwError } from 'rxjs';
import { PageExitService } from './page-exit.service';

/**
 * Al recargar o salir, WebKit a veces entrega a la app la cancelación de las peticiones en vuelo (status 0) entre
 * beforeunload y pagehide; sin quien la maneje, terminaba en el ErrorHandler global como "ERROR HttpErrorResponse".
 * Solo esa cancelación se descarta: la petición queda sin respuesta (NEVER, no EMPTY, para que firstValueFrom no
 * falle con EmptyError mientras la página se va). Cualquier otro error, incluido un status 0 de red caída con la
 * página abierta, sigue llegando igual que antes.
 */
export const pageExitInterceptor: HttpInterceptorFn = (req, next) => {
  const page = inject(PageExitService);
  return next(req).pipe(
    catchError((error: unknown) =>
      error instanceof HttpErrorResponse && error.status === 0 && page.isLeaving() ? NEVER : throwError(() => error)
    )
  );
};
