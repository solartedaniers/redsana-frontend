import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { APP_PATHS } from '../routing/app-paths';

/** Espera a saber si hay sesión (el backend puede estar despertando) y solo entonces decide. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .whenRestored()
    .pipe(map(() => (auth.isAuthenticated() ? true : router.createUrlTree([APP_PATHS.login]))));
};
