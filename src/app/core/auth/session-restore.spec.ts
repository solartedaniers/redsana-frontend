import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, Subject, isObservable, of, throwError } from 'rxjs';
import { AuthSession, UserRole } from '../models/user.model';
import { APP_PATHS } from '../routing/app-paths';
import { authGuard } from './auth.guard';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { roleGuard } from './role.guard';
import { SESSION_RESTORE_CONFIG } from './session-restore.config';

const session = (role: UserRole): AuthSession => ({
  user: { id: 'u1', email: 'demo@example.invalid', fullName: 'Demo', avatarUrl: null, role },
  token: 'token',
  expiresAt: new Date(0).toISOString(),
});

/** Cada llamada a restoreSession toma la siguiente respuesta; la última se repite. */
function setup(...answers: Array<() => Observable<AuthSession | null>>) {
  let call = 0;
  const repository = { restoreSession: vi.fn(() => answers[Math.min(call++, answers.length - 1)]()) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthRepository, useValue: repository }] });
  const auth = TestBed.inject(AuthService);
  auth.startRestore();
  return { auth, repository };
}

/** Corre un guard y devuelve lo que decidió (o 'waiting' si todavía no decidió). */
function runGuard(guard: typeof authGuard): { result: () => boolean | UrlTree | 'waiting' } {
  let result: boolean | UrlTree | 'waiting' = 'waiting';
  const outcome = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  if (isObservable(outcome)) {
    outcome.subscribe((value) => (result = value as boolean | UrlTree));
  } else {
    result = outcome as boolean | UrlTree;
  }
  return { result: () => result };
}

const toLogin = (value: unknown) => value instanceof UrlTree && value.toString() === APP_PATHS.login;
const serverWaking = () => throwError(() => new HttpErrorResponse({ status: 503 }));

describe('Restauración de la sesión y guards', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('si el perfil llega a tiempo, el guard de rol deja pasar al rol correcto', () => {
    setup(() => of(session('standard')));

    expect(runGuard(authGuard).result()).toBe(true);
    expect(runGuard(roleGuard(['standard'])).result()).toBe(true);
  });

  it('con otro rol manda al login', () => {
    setup(() => of(session('standard')));

    expect(toLogin(runGuard(roleGuard(['admin'])).result())).toBe(true);
  });

  it('sin sesión guardada manda al login sin esperar', () => {
    setup(() => of(null));

    expect(toLogin(runGuard(authGuard).result())).toBe(true);
  });

  it('mientras el backend despierta, el guard espera y la app muestra la espera; luego deja pasar', () => {
    const profile = new Subject<AuthSession>();
    const { auth } = setup(() => profile);
    const guard = runGuard(roleGuard(['standard']));
    TestBed.tick();

    expect(guard.result()).toBe('waiting');
    expect(auth.isWaitingForSession()).toBe(true);
    expect(auth.restoreState()).toBe('pending');

    profile.next(session('standard'));
    TestBed.tick();

    expect(guard.result()).toBe(true);
    expect(auth.isWaitingForSession()).toBe(false);
  });

  it('los errores mientras Render despierta se reintentan hasta que el perfil llega', () => {
    const { auth, repository } = setup(serverWaking, serverWaking, () => of(session('admin')));
    const guard = runGuard(roleGuard(['admin']));

    vi.advanceTimersByTime(SESSION_RESTORE_CONFIG.retryDelayMs * 2);
    TestBed.tick();

    expect(repository.restoreSession).toHaveBeenCalledTimes(3);
    expect(auth.restoreState()).toBe('restored');
    expect(guard.result()).toBe(true);
  });

  it('si vence el plazo queda en fallo, el guard sigue esperando y reintentar lo resuelve', () => {
    const { auth } = setup(serverWaking, serverWaking, serverWaking, () => of(session('standard')));
    const guard = runGuard(authGuard);
    TestBed.tick();
    // Responde siempre con error hasta el plazo: con estos tiempos quedan como mucho unos pocos intentos.
    const repository = TestBed.inject(AuthRepository) as unknown as { restoreSession: ReturnType<typeof vi.fn> };
    repository.restoreSession.mockImplementation(serverWaking);

    vi.advanceTimersByTime(SESSION_RESTORE_CONFIG.profileTimeoutMs);
    TestBed.tick();

    expect(auth.restoreState()).toBe('failed');
    expect(guard.result()).toBe('waiting');
    expect(auth.isWaitingForSession()).toBe(true);

    repository.restoreSession.mockImplementation(() => of(session('standard')));
    auth.retryRestore();
    TestBed.tick();

    expect(auth.restoreState()).toBe('restored');
    expect(guard.result()).toBe(true);
  });

  it('una sesión rechazada por el backend (401) cuenta como sin sesión y manda al login', () => {
    const { auth, repository } = setup(() => throwError(() => new HttpErrorResponse({ status: 401 })));

    expect(repository.restoreSession).toHaveBeenCalledOnce();
    expect(auth.isAuthenticated()).toBe(false);
    expect(toLogin(runGuard(authGuard).result())).toBe(true);
  });

  it('iniciar sesión a mano resuelve la espera aunque la restauración siga pendiente', () => {
    const { auth } = setup(() => new Subject<AuthSession>());
    const repository = TestBed.inject(AuthRepository) as unknown as Record<string, unknown>;
    repository['signIn'] = () => of(session('standard'));
    const guard = runGuard(authGuard);
    TestBed.tick();

    auth.signIn('demo@example.invalid', 'secret').subscribe();
    TestBed.tick();

    expect(guard.result()).toBe(true);
  });
});
