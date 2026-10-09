import { Route, Routes } from '@angular/router';
import { routes } from '../../app.routes';
import { ADMIN_ROUTES } from '../../features/admin/admin.routes';
import { AUTH_ROUTES } from '../../features/auth/auth.routes';
import { USER_ROUTES } from '../../features/user/user.routes';
import { APP_PATHS, ROUTE_SEGMENTS } from './app-paths';

// Las rutas hijas se cargan perezosamente, así que las engancho a mano con su padre.
const LAZY_CHILDREN: Record<string, Routes> = {
  [ROUTE_SEGMENTS.auth]: AUTH_ROUTES,
  [ROUTE_SEGMENTS.user]: USER_ROUTES,
  [ROUTE_SEGMENTS.admin]: ADMIN_ROUTES,
};

function collectPaths(routeList: Routes, prefix = ''): string[] {
  return routeList.flatMap((route: Route) => {
    if (route.redirectTo || route.path === '**') return [];
    const full = [prefix, route.path].filter(Boolean).join('/');
    const children = [...(route.children ?? []), ...(LAZY_CHILDREN[route.path ?? ''] ?? [])];
    return [`/${full}`, ...collectPaths(children, full)];
  });
}

describe('APP_PATHS', () => {
  it('cada ruta usada por enlaces, guards y menú existe en la configuración del router', () => {
    const configured = new Set(collectPaths(routes));
    const missing = Object.values(APP_PATHS).filter((path) => !configured.has(path));
    expect(missing).toEqual([]);
  });

  it('las URLs siguen el estilo del proyecto: inglés en minúsculas separado por guiones', () => {
    for (const path of Object.values(APP_PATHS)) {
      expect(path).toMatch(/^\/([a-z]+(-[a-z]+)*(\/[a-z]+(-[a-z]+)*)*)?$/);
    }
  });
});
