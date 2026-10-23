import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';

/** Clave i18n del aviso; el login la muestra tal cual, como el resto de los errores de autenticación. */
export const ACCOUNT_SUSPENDED_ERROR_KEY = 'auth.errors.accountSuspended';

/** El backend rechazó el perfil (/api/users/me) con 403: un admin suspendió la cuenta. No tiene sentido reintentar. */
export class AccountSuspendedError extends Error {
  constructor() {
    super(ACCOUNT_SUSPENDED_ERROR_KEY);
    this.name = 'AccountSuspendedError';
  }
}

/** /api/users/me solo responde 403 por cuenta suspendida; otras rutas usan 403 para "no es admin". */
export function isSuspendedProfileResponse(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === HttpStatusCode.Forbidden;
}
