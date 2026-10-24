import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { sessionHomeRedirect } from './core/auth/session-home.redirect';
import { webOnlyGuard } from './core/runtime/web-only.guard';
import { APP_PATHS, ROUTE_SEGMENTS } from './core/routing/app-paths';
import { SEO_CONFIG } from './core/i18n/seo.config';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [webOnlyGuard],
    // La única ruta pública con contenido propio: la que va a buscadores (ver DocumentMetadataService y robots.txt).
    data: { [SEO_CONFIG.indexableRouteDataKey]: true },
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [{ path: '', loadComponent: () => import('./features/landing/landing').then((m) => m.Landing) }],
  },
  {
    path: ROUTE_SEGMENTS.auth,
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: ROUTE_SEGMENTS.user,
    loadComponent: () => import('./layouts/app-shell-layout/app-shell-layout').then((m) => m.AppShellLayout),
    canActivate: [authGuard, roleGuard(['standard'])],
    loadChildren: () => import('./features/user/user.routes').then((m) => m.USER_ROUTES),
  },
  {
    path: ROUTE_SEGMENTS.admin,
    loadComponent: () => import('./layouts/app-shell-layout/app-shell-layout').then((m) => m.AppShellLayout),
    canActivate: [authGuard, roleGuard(['admin'])],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: `${ROUTE_SEGMENTS.account}/${ROUTE_SEGMENTS.profile}`,
    loadComponent: () => import('./layouts/app-shell-layout/app-shell-layout').then((m) => m.AppShellLayout),
    canActivate: [authGuard],
    children: [{ path: '', loadComponent: () => import('./features/auth/profile/profile').then((m) => m.Profile) }],
  },
  { path: '', redirectTo: sessionHomeRedirect, pathMatch: 'full' },
  { path: '**', redirectTo: APP_PATHS.login },
];
