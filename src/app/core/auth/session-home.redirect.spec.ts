import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { routes } from '../../app.routes';
import tauriConfig from '../../../../src-tauri/tauri.conf.json';
import { AuthSession, UserRole } from '../models/user.model';
import { APP_PATHS } from '../routing/app-paths';
import { RuntimeEnvironmentService } from '../runtime/runtime-environment.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

const session = (role: UserRole): AuthSession => ({
  user: { id: 'u1', email: 'demo@example.invalid', fullName: 'Demo', avatarUrl: null, role },
  token: 'token',
  expiresAt: new Date(0).toISOString(),
});

// Lo que abre cada uno al arrancar: la ventana de Tauri carga index.csr.html (tauri.conf.json); el navegador, "/".
const DESKTOP_START_URL = '/index.csr.html';

/** Abre la app con las rutas reales, como lo hace la ventana del escritorio o el navegador al entrar. */
async function openRoot(
  isDesktop: boolean,
  restore: () => Observable<AuthSession | null>,
  url = isDesktop ? DESKTOP_START_URL : '/',
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      { provide: RuntimeEnvironmentService, useValue: { isDesktop } },
      { provide: AuthRepository, useValue: { restoreSession: vi.fn(restore) } },
    ],
  });
  const auth = TestBed.inject(AuthService);
  auth.startRestore();
  const router = TestBed.inject(Router);
  const navigation = router.navigateByUrl(url);
  return { auth, router, navigation };
}

describe('Al abrir la app', () => {
  it('escritorio con sesión: abre en el panel', async () => {
    const { router, navigation } = await openRoot(true, () => of(session('standard')));

    await navigation;
    expect(router.url).toBe(APP_PATHS.userDashboard);
  });

  it('escritorio sin sesión: abre en el login', async () => {
    const { router, navigation } = await openRoot(true, () => of(null));

    await navigation;
    expect(router.url).toBe(APP_PATHS.login);
  });

  it('escritorio con sesión de admin: abre en el panel de admin', async () => {
    const { router, navigation } = await openRoot(true, () => of(session('admin')));

    await navigation;
    expect(router.url).toBe(APP_PATHS.adminDashboard);
  });

  it('escritorio con sesión guardada y sin red: muestra la espera, no el login', async () => {
    vi.useFakeTimers();
    const { auth, router } = await openRoot(true, () => throwError(() => new HttpErrorResponse({ status: 0 })));
    await vi.advanceTimersByTimeAsync(1000);

    expect(auth.isWaitingForSession()).toBe(true);
    expect(router.url).not.toBe(APP_PATHS.login);
    vi.useRealTimers();
  });

  it('escritorio: "/" también abre en el panel', async () => {
    const { router, navigation } = await openRoot(true, () => of(session('standard')), '/');

    await navigation;
    expect(router.url).toBe(APP_PATHS.userDashboard);
  });

  it('la ventana de Tauri arranca en la URL que prueba esta suite', () => {
    expect(`/${tauriConfig.app.windows[0].url}`).toBe(DESKTOP_START_URL);
  });

  it('web: una ruta desconocida sigue yendo al login, con o sin sesión', async () => {
    for (const restore of [() => of(session('standard')), () => of(null)]) {
      TestBed.resetTestingModule();
      const { router, navigation } = await openRoot(false, restore, '/no-existe');

      await navigation;
      expect(router.url).toBe(APP_PATHS.login);
    }
  });

  it('web: sigue siendo la landing, con o sin sesión', async () => {
    for (const restore of [() => of(session('standard')), () => of(null)]) {
      TestBed.resetTestingModule();
      const { router, navigation } = await openRoot(false, restore);

      await navigation;
      expect(router.url).toBe(APP_PATHS.root);
    }
  });
});
