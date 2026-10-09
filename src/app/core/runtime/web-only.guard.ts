import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { RuntimeEnvironmentService } from './runtime-environment.service';

// En escritorio la app ya está instalada: no tiene sentido mostrar la landing, abro directo en el login.
export const webOnlyGuard: CanMatchFn = () => !inject(RuntimeEnvironmentService).isDesktop;
