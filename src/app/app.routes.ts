import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'user',
    loadComponent: () => import('./layouts/app-shell-layout/app-shell-layout').then((m) => m.AppShellLayout),
    canActivate: [authGuard, roleGuard(['standard'])],
    loadChildren: () => import('./features/user/user.routes').then((m) => m.USER_ROUTES),
  },
  {
    path: 'admin',
    loadComponent: () => import('./layouts/app-shell-layout/app-shell-layout').then((m) => m.AppShellLayout),
    canActivate: [authGuard, roleGuard(['admin'])],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'account/profile',
    loadComponent: () => import('./layouts/app-shell-layout/app-shell-layout').then((m) => m.AppShellLayout),
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./features/auth/profile/profile').then((m) => m.Profile) },
    ],
  },
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth/login' },
];
