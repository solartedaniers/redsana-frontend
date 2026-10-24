import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NEVER, catchError, throwError } from 'rxjs';
import { PageExitService } from './page-exit.service';

// WebKit entrega la cancelación por recarga (status 0) antes de pagehide y llegaba al ErrorHandler global; solo esa
// se descarta. NEVER y no EMPTY: firstValueFrom fallaría con EmptyError mientras la página se va.
export const pageExitInterceptor: HttpInterceptorFn = (req, next) => {
  const page = inject(PageExitService);
  return next(req).pipe(
    catchError((error: unknown) =>
      error instanceof HttpErrorResponse && error.status === 0 && page.isLeaving() ? NEVER : throwError(() => error)
    )
  );
};
