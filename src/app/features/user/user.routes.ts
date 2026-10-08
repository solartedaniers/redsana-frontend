import { Routes } from '@angular/router';
import { webOnlyGuard } from '../../core/runtime/web-only.guard';
import { ROUTE_SEGMENTS } from '../../core/routing/app-paths';

export const USER_ROUTES: Routes = [
  {
    path: ROUTE_SEGMENTS.dashboard,
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: ROUTE_SEGMENTS.securityAssistant,
    loadComponent: () =>
      import('./security-assistant/security-assistant').then((m) => m.SecurityAssistant),
  },
  {
    path: ROUTE_SEGMENTS.alerts,
    loadComponent: () => import('./alerts-center/alerts-center').then((m) => m.AlertsCenter),
  },
  {
    path: ROUTE_SEGMENTS.devices,
    loadComponent: () => import('./devices-map/devices-map').then((m) => m.DevicesMap),
  },
  {
    path: ROUTE_SEGMENTS.familyMode,
    loadComponent: () => import('./family-mode/family-mode').then((m) => m.FamilyMode),
  },
  {
    // Solo web: en el escritorio la app ya está instalada.
    path: ROUTE_SEGMENTS.download,
    canMatch: [webOnlyGuard],
    loadComponent: () => import('./desktop-download/desktop-download').then((m) => m.DesktopDownload),
  },
  { path: '', redirectTo: ROUTE_SEGMENTS.dashboard, pathMatch: 'full' },
];
