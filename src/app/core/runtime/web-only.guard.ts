import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { RuntimeEnvironmentService } from './runtime-environment.service';

// El escritorio ya es la app instalada: no tiene sentido presentarle la
// landing, así que sigue abriendo directo en el login como siempre.
export const webOnlyGuard: CanMatchFn = () => !inject(RuntimeEnvironmentService).isDesktop;
