import { Routes } from '@angular/router';
import { ROUTE_SEGMENTS } from '../../core/routing/app-paths';

export const AUTH_ROUTES: Routes = [
  {
    path: ROUTE_SEGMENTS.login,
    loadComponent: () => import('./login/login').then((m) => m.Login),
  },
  {
    path: ROUTE_SEGMENTS.register,
    loadComponent: () => import('./register/register').then((m) => m.Register),
  },
  {
    path: ROUTE_SEGMENTS.forgotPassword,
    loadComponent: () => import('./forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    // Destino del enlace del correo de recuperación.
    path: ROUTE_SEGMENTS.resetPassword,
    loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPassword),
  },
  { path: '', redirectTo: ROUTE_SEGMENTS.login, pathMatch: 'full' },
];
