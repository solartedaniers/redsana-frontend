import { inject } from '@angular/core';
import { RedirectFunction } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { APP_PATHS } from '../routing/app-paths';
import { RuntimeEnvironmentService } from '../runtime/runtime-environment.service';
import { UserRole } from '../models/user.model';

/** La pantalla de inicio de cada rol después de entrar. */
export function homePathFor(role: UserRole): string {
  return role === 'admin' ? APP_PATHS.adminDashboard : APP_PATHS.userDashboard;
}

/**
 * Adónde va una ruta sin pantalla. En la web, al login como siempre. En el escritorio (la ventana abre en
 * index.csr.html): con sesión al panel de su rol y sin sesión al login; mientras se restaura (o si falla por falta de
 * red) la app muestra la espera o el fallo, no el login.
 */
export const sessionHomeRedirect: RedirectFunction = () => {
  if (!inject(RuntimeEnvironmentService).isDesktop) {
    return APP_PATHS.login;
  }
  const auth = inject(AuthService);
  return auth.whenRestored().pipe(
    map(() => {
      const role = auth.role();
      return role ? homePathFor(role) : APP_PATHS.login;
    }),
  );
};
