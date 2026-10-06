import { Routes } from '@angular/router';
import { webOnlyGuard } from '../../core/runtime/web-only.guard';

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
    path: 'family-mode',
    loadComponent: () => import('./family-mode/family-mode').then((m) => m.FamilyMode),
  },
  {
    // Solo web: en el escritorio la app ya está instalada.
    path: 'download',
    canMatch: [webOnlyGuard],
    loadComponent: () => import('./desktop-download/desktop-download').then((m) => m.DesktopDownload),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
