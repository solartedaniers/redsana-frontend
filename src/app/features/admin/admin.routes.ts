import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
  },
  {
    path: 'network-supervision',
    loadComponent: () =>
      import('./network-supervision/network-supervision').then((m) => m.NetworkSupervision),
  },
  {
    path: 'network-supervision/:id',
    loadComponent: () => import('./household-detail/household-detail').then((m) => m.HouseholdDetail),
  },
  {
    path: 'users',
    loadComponent: () => import('./user-management/user-management').then((m) => m.UserManagement),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
