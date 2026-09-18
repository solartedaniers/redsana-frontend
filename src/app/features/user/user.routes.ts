import { Routes } from '@angular/router';

export const USER_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'security-assistant',
    loadComponent: () =>
      import('./security-assistant/security-assistant').then((m) => m.SecurityAssistant),
  },
  {
    path: 'alerts',
    loadComponent: () => import('./alerts-center/alerts-center').then((m) => m.AlertsCenter),
  },
  {
    path: 'devices',
    loadComponent: () => import('./devices-map/devices-map').then((m) => m.DevicesMap),
  },
  {
    path: 'provider-history',
    loadComponent: () => import('./provider-history/provider-history').then((m) => m.ProviderHistory),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
