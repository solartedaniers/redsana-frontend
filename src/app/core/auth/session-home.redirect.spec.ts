import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { routes } from '../../app.routes';
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

/** Abre "/" con las rutas reales de la app, como lo hace la ventana del escritorio o el navegador al entrar. */
async function openRoot(isDesktop: boolean, restore: () => Observable<AuthSession | null>) {
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
  const navigation = router.navigateByUrl('/');
  return { auth, router, navigation };
}

describe('Al abrir la app en "/"', () => {
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

  it('web: sigue siendo la landing, con o sin sesión', async () => {
    for (const restore of [() => of(session('standard')), () => of(null)]) {
      TestBed.resetTestingModule();
      const { router, navigation } = await openRoot(false, restore);

      await navigation;
      expect(router.url).toBe(APP_PATHS.root);
    }
  });
});
