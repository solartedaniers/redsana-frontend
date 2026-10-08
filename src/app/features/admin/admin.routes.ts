import { Routes } from '@angular/router';
import { ROUTE_SEGMENTS } from '../../core/routing/app-paths';

export const ADMIN_ROUTES: Routes = [
  {
    path: ROUTE_SEGMENTS.dashboard,
    loadComponent: () => import('./admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
  },
  {
    path: ROUTE_SEGMENTS.networkSupervision,
    loadComponent: () =>
      import('./network-supervision/network-supervision').then((m) => m.NetworkSupervision),
  },
  {
    path: `${ROUTE_SEGMENTS.networkSupervision}/:id`,
    loadComponent: () => import('./household-detail/household-detail').then((m) => m.HouseholdDetail),
  },
  {
    path: ROUTE_SEGMENTS.users,
    loadComponent: () => import('./user-management/user-management').then((m) => m.UserManagement),
  },
  { path: '', redirectTo: ROUTE_SEGMENTS.dashboard, pathMatch: 'full' },
];
