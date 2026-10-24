import { inject } from '@angular/core';
import { RedirectFunction } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { APP_PATHS } from '../routing/app-paths';
import { UserRole } from '../models/user.model';

/** La pantalla de inicio de cada rol después de entrar. */
export function homePathFor(role: UserRole): string {
  return role === 'admin' ? APP_PATHS.adminDashboard : APP_PATHS.userDashboard;
}

/**
 * Solo llega aquí el escritorio (en la web "/" es la landing). Con sesión abre en el panel de su rol y sin sesión en
 * el login; mientras se restaura (o si falla por falta de red) la app muestra la espera o el fallo, no el login.
 */
export const sessionHomeRedirect: RedirectFunction = () => {
  const auth = inject(AuthService);
  return auth.whenRestored().pipe(
    map(() => {
      const role = auth.role();
      return role ? homePathFor(role) : APP_PATHS.login;
    }),
  );
};
