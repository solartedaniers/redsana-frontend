import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { RuntimeEnvironmentService } from './runtime-environment.service';

// En escritorio la app ya está instalada: no tiene sentido mostrar la landing, abro en el panel o en el login
// (ver sessionHomeRedirect).
export const webOnlyGuard: CanMatchFn = () => !inject(RuntimeEnvironmentService).isDesktop;
