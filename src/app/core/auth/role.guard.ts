import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { APP_PATHS } from '../routing/app-paths';
import { UserRole } from '../models/user.model';

/** El rol llega con el perfil del backend: espero a tenerlo para no mostrar una pantalla de otro rol. */
export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.whenRestored().pipe(
      map(() => {
        const role = auth.role();
        return role !== null && allowedRoles.includes(role) ? true : router.createUrlTree([APP_PATHS.login]);
      }),
    );
  };
}
