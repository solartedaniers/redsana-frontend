import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthSession } from '../models/user.model';
import { APP_PATHS } from '../routing/app-paths';
import { RuntimeEnvironmentService } from '../runtime/runtime-environment.service';
import { AccountSuspendedError } from './account-suspended.error';
import { AuthRepository } from './auth.repository';
import { SupabaseAuthRepository } from './auth-supabase.repository';
import { supabaseClient } from './supabase-client';

// Fija el comportamiento de AuthRepository con Supabase y el backend simulados; fetch queda vigilado para que nada
// salga a la red.

const ME_URL = `${environment.apiBaseUrl}/api/users/me`;
const EXPIRES_AT = 1_800_000_000;
const BACKEND_USER = {
  id: 'u1',
  email: 'demo@example.invalid',
  full_name: 'Demo',
  avatar_url: 'https://cdn.example.invalid/a.png',
  role: 'standard',
  is_active: true,
};
const EXPECTED_SESSION: AuthSession = {
  user: { id: 'u1', email: 'demo@example.invalid', fullName: 'Demo', avatarUrl: 'https://cdn.example.invalid/a.png', role: 'standard' },
  token: 'access-token',
  expiresAt: new Date(EXPIRES_AT * 1000).toISOString(),
};
const SUPABASE_SESSION = { access_token: 'access-token', expires_at: EXPIRES_AT };

type Auth = typeof supabaseClient.auth;
const auth = supabaseClient.auth;
// Respuestas de supabase-js con la forma justa que lee el repositorio.
const answer = <K extends keyof Auth>(_method: K, value: unknown) =>
  value as Awaited<ReturnType<Extract<Auth[K], (...args: never[]) => unknown>>>;

let fetchSpy: ReturnType<typeof vi.spyOn>;

function setup(isDesktop = false): { repository: AuthRepository; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthRepository, useClass: SupabaseAuthRepository },
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RuntimeEnvironmentService, useValue: { isDesktop } },
    ],
  });
  return { repository: TestBed.inject(AuthRepository), http: TestBed.inject(HttpTestingController) };
}

/** El repositorio pide el perfil tras resolver una promesa de Supabase: espero a que la petición exista. */
async function nextRequest(http: HttpTestingController, method: string, url = ME_URL): Promise<TestRequest> {
  let request: TestRequest | undefined;
  await vi.waitFor(() => {
    request = http.expectOne((r) => r.method === method && r.url === url);
  });
  return request!;
}

async function settle<T>(result: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  return result.then(
    (value) => ({ value }),
    (error: unknown) => ({ error })
  );
}

const signOutSpy = () => vi.spyOn(auth, 'signOut').mockResolvedValue(answer('signOut', { error: null }));

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sin red en las pruebas'));
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  TestBed.inject(HttpTestingController).verify();
  vi.restoreAllMocks();
});

describe('Iniciar sesión', () => {
  it('con credenciales correctas arma la sesión con el perfil del backend', async () => {
    const { repository, http } = setup();
    const signIn = vi
      .spyOn(auth, 'signInWithPassword')
      .mockResolvedValue(answer('signInWithPassword', { data: { session: SUPABASE_SESSION }, error: null }));

    const result = firstValueFrom(repository.signIn('demo@example.invalid', 'secreto'));
    (await nextRequest(http, 'GET')).flush(BACKEND_USER);

    expect(await result).toEqual(EXPECTED_SESSION);
    expect(signIn).toHaveBeenCalledExactlyOnceWith({ email: 'demo@example.invalid', password: 'secreto' });
  });

  it('un perfil sin nombre queda con nombre vacío', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue(
      answer('signInWithPassword', { data: { session: SUPABASE_SESSION }, error: null })
    );

    const result = firstValueFrom(repository.signIn('demo@example.invalid', 'secreto'));
    (await nextRequest(http, 'GET')).flush({ ...BACKEND_USER, full_name: null, avatar_url: null });

    expect((await result).user).toEqual({ ...EXPECTED_SESSION.user, fullName: '', avatarUrl: null });
  });

  it('con credenciales malas da la clave de credenciales inválidas y no pide el perfil', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue(
      answer('signInWithPassword', { data: { session: null }, error: { message: 'Invalid login credentials' } })
    );

    const { error } = await settle(firstValueFrom(repository.signIn('demo@example.invalid', 'mala')));

    expect(error).toEqual(new Error('auth.errors.invalidCredentials'));
  });

  it('un error de red de Supabase se traduce como error desconocido', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue(
      answer('signInWithPassword', { data: { session: null }, error: { message: 'Failed to fetch' } })
    );

    const { error } = await settle(firstValueFrom(repository.signIn('demo@example.invalid', 'secreto')));

    expect(error).toEqual(new Error('auth.errors.unknown'));
  });

  it('sin error pero sin sesión también es un error desconocido', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue(
      answer('signInWithPassword', { data: { session: null }, error: null })
    );

    const { error } = await settle(firstValueFrom(repository.signIn('demo@example.invalid', 'secreto')));

    expect(error).toEqual(new Error('auth.errors.unknown'));
  });

  it('si la promesa de Supabase falla, el error llega tal cual', async () => {
    const { repository } = setup();
    const failure = new TypeError('Failed to fetch');
    vi.spyOn(auth, 'signInWithPassword').mockRejectedValue(failure);

    const { error } = await settle(firstValueFrom(repository.signIn('demo@example.invalid', 'secreto')));

    expect(error).toBe(failure);
  });

  it('con la cuenta suspendida (403 del perfil) borra la sesión local y avisa', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue(
      answer('signInWithPassword', { data: { session: SUPABASE_SESSION }, error: null })
    );
    const signOut = signOutSpy();

    const result = settle(firstValueFrom(repository.signIn('demo@example.invalid', 'secreto')));
    (await nextRequest(http, 'GET')).flush({ detail: 'Account suspended' }, { status: 403, statusText: 'Forbidden' });

    expect((await result).error).toBeInstanceOf(AccountSuspendedError);
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
  });

  it('un error inesperado del perfil (500) sigue siendo un error HTTP y no cierra la sesión', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue(
      answer('signInWithPassword', { data: { session: SUPABASE_SESSION }, error: null })
    );
    const signOut = signOutSpy();

    const result = settle(firstValueFrom(repository.signIn('demo@example.invalid', 'secreto')));
    (await nextRequest(http, 'GET')).flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });

    const { error } = await result;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(500);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('Registrarse', () => {
  const payload = { fullName: 'Nueva Persona', email: 'nueva@example.invalid', password: 'Clave-Segura-123' };

  it('crea la cuenta con el nombre en los metadatos y arma la sesión con el perfil', async () => {
    const { repository, http } = setup();
    const signUp = vi
      .spyOn(auth, 'signUp')
      .mockResolvedValue(answer('signUp', { data: { session: SUPABASE_SESSION }, error: null }));

    const result = firstValueFrom(repository.signUp(payload));
    (await nextRequest(http, 'GET')).flush(BACKEND_USER);

    expect(await result).toEqual(EXPECTED_SESSION);
    expect(signUp).toHaveBeenCalledExactlyOnceWith({
      email: payload.email,
      password: payload.password,
      options: { data: { full_name: payload.fullName } },
    });
  });

  it('un correo ya registrado da la clave de correo ocupado', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'signUp').mockResolvedValue(
      answer('signUp', { data: { session: null }, error: { message: 'User already registered' } })
    );

    expect((await settle(firstValueFrom(repository.signUp(payload)))).error).toEqual(new Error('auth.errors.emailTaken'));
  });

  it('otro error de Supabase es desconocido', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'signUp').mockResolvedValue(
      answer('signUp', { data: { session: null }, error: { message: 'Signups not allowed' } })
    );

    expect((await settle(firstValueFrom(repository.signUp(payload)))).error).toEqual(new Error('auth.errors.unknown'));
  });

  it('con confirmación de correo activa (sin sesión) pide confirmar y no pide el perfil', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'signUp').mockResolvedValue(answer('signUp', { data: { session: null }, error: null }));

    expect((await settle(firstValueFrom(repository.signUp(payload)))).error).toEqual(
      new Error('auth.errors.confirmationRequired')
    );
  });
});

describe('Cerrar sesión', () => {
  it('cierra la sesión en Supabase (sin alcance local) y termina sin valor', async () => {
    const { repository } = setup();
    const signOut = signOutSpy();

    expect(await firstValueFrom(repository.signOut())).toBeUndefined();
    expect(signOut).toHaveBeenCalledExactlyOnceWith();
  });
});

describe('Restaurar la sesión al abrir la app', () => {
  it('con una sesión guardada la completa con el perfil del backend', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'getSession').mockResolvedValue(answer('getSession', { data: { session: SUPABASE_SESSION }, error: null }));

    const result = firstValueFrom(repository.restoreSession());
    (await nextRequest(http, 'GET')).flush(BACKEND_USER);

    expect(await result).toEqual(EXPECTED_SESSION);
  });

  it('sin sesión guardada devuelve null y no pide el perfil', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'getSession').mockResolvedValue(answer('getSession', { data: { session: null }, error: null }));

    expect(await firstValueFrom(repository.restoreSession())).toBeNull();
  });

  it('una sesión vencida que Supabase no pudo renovar cuenta como sin sesión', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'getSession').mockResolvedValue(
      answer('getSession', { data: { session: null }, error: { message: 'Invalid Refresh Token: Refresh Token Not Found' } })
    );

    expect(await firstValueFrom(repository.restoreSession())).toBeNull();
  });

  it('un token vencido que el backend rechaza (401) llega como error HTTP sin cerrar la sesión', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'getSession').mockResolvedValue(answer('getSession', { data: { session: SUPABASE_SESSION }, error: null }));
    const signOut = signOutSpy();

    const result = settle(firstValueFrom(repository.restoreSession()));
    (await nextRequest(http, 'GET')).flush({ detail: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });

    expect(((await result).error as HttpErrorResponse).status).toBe(401);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('sin fecha de vencimiento usa la hora actual', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'getSession').mockResolvedValue(
      answer('getSession', { data: { session: { access_token: 'access-token' } }, error: null })
    );
    const before = Date.now();

    const result = firstValueFrom(repository.restoreSession());
    (await nextRequest(http, 'GET')).flush(BACKEND_USER);
    const expiresAt = Date.parse((await result)!.expiresAt);

    expect(expiresAt).toBeGreaterThanOrEqual(before);
    expect(expiresAt).toBeLessThanOrEqual(Date.now());
  });

  it('si leer la sesión falla de forma inesperada, el error llega tal cual', async () => {
    const { repository } = setup();
    const failure = new Error('storage roto');
    vi.spyOn(auth, 'getSession').mockRejectedValue(failure);

    expect((await settle(firstValueFrom(repository.restoreSession()))).error).toBe(failure);
  });
});

describe('Recuperar la contraseña', () => {
  async function requestFrom(isDesktop: boolean) {
    const { repository } = setup(isDesktop);
    const reset = vi
      .spyOn(auth, 'resetPasswordForEmail')
      .mockResolvedValue(answer('resetPasswordForEmail', { data: {}, error: null }));
    const value = await firstValueFrom(repository.requestPasswordReset('demo@example.invalid'));
    return { value, reset };
  }

  it('en la web el enlace vuelve al mismo origen, a la pantalla de nueva contraseña', async () => {
    const { value, reset } = await requestFrom(false);

    expect(value).toBeUndefined();
    expect(reset).toHaveBeenCalledExactlyOnceWith('demo@example.invalid', {
      redirectTo: `${window.location.origin}${APP_PATHS.resetPassword}`,
    });
  });

  it('en Tauri el enlace va a la web pública de WEB_APP_URL', async () => {
    const { reset } = await requestFrom(true);

    expect(reset).toHaveBeenCalledExactlyOnceWith('demo@example.invalid', {
      redirectTo: `${environment.webAppUrl}${APP_PATHS.resetPassword}`,
    });
    expect(environment.webAppUrl).not.toBe(window.location.origin);
  });

  it('detecta si se llegó desde el enlace con una sesión de recuperación', async () => {
    const { repository } = setup();
    const getSession = vi.spyOn(auth, 'getSession');

    getSession.mockResolvedValueOnce(answer('getSession', { data: { session: SUPABASE_SESSION }, error: null }));
    expect(await firstValueFrom(repository.hasRecoverySession())).toBe(true);

    getSession.mockResolvedValueOnce(answer('getSession', { data: { session: null }, error: null }));
    expect(await firstValueFrom(repository.hasRecoverySession())).toBe(false);
  });

  it('fija la nueva contraseña con la sesión de recuperación', async () => {
    const { repository } = setup();
    const update = vi.spyOn(auth, 'updateUser').mockResolvedValue(answer('updateUser', { data: {}, error: null }));

    expect(await firstValueFrom(repository.resetPassword('Nueva-Clave-123'))).toBeUndefined();
    expect(update).toHaveBeenCalledExactlyOnceWith({ password: 'Nueva-Clave-123' });
  });

  it('si Supabase rechaza la nueva contraseña traduce el error', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'updateUser').mockResolvedValue(
      answer('updateUser', { data: {}, error: { message: 'New password should be different' } })
    );

    expect((await settle(firstValueFrom(repository.resetPassword('Nueva-Clave-123')))).error).toEqual(
      new Error('auth.errors.unknown')
    );
  });
});

describe('Perfil', () => {
  it('actualizar el nombre lo cambia en Supabase, sincroniza el backend y vuelve a leer el perfil', async () => {
    const { repository, http } = setup();
    const update = vi.spyOn(auth, 'updateUser').mockResolvedValue(answer('updateUser', { data: {}, error: null }));
    vi.spyOn(auth, 'getSession').mockResolvedValue(answer('getSession', { data: { session: SUPABASE_SESSION }, error: null }));

    const result = firstValueFrom(repository.updateProfile('u1', { fullName: 'Otro Nombre' }));
    const patch = await nextRequest(http, 'PATCH');
    expect(patch.request.body).toEqual({ full_name: 'Otro Nombre' });
    patch.flush(null);
    (await nextRequest(http, 'GET')).flush({ ...BACKEND_USER, full_name: 'Otro Nombre' });

    expect((await result).user.fullName).toBe('Otro Nombre');
    expect(update).toHaveBeenCalledExactlyOnceWith({ data: { full_name: 'Otro Nombre' } });
  });

  it('si Supabase rechaza el nombre no toca el backend', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'updateUser').mockResolvedValue(
      answer('updateUser', { data: {}, error: { message: 'User already registered' } })
    );

    expect((await settle(firstValueFrom(repository.updateProfile('u1', { fullName: 'X' })))).error).toEqual(
      new Error('auth.errors.emailTaken')
    );
  });

  it('si al final no hay sesión, el usuario no existe', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'updateUser').mockResolvedValue(answer('updateUser', { data: {}, error: null }));
    vi.spyOn(auth, 'getSession').mockResolvedValue(answer('getSession', { data: { session: null }, error: null }));

    const result = settle(firstValueFrom(repository.updateProfile('u1', { fullName: 'X' })));
    (await nextRequest(http, 'PATCH')).flush(null);

    expect((await result).error).toEqual(new Error('auth.errors.userNotFound'));
  });

  it('actualizar la foto guarda su URL en el backend y vuelve a leer el perfil', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'getSession').mockResolvedValue(answer('getSession', { data: { session: SUPABASE_SESSION }, error: null }));

    const result = firstValueFrom(repository.updateAvatar('u1', 'https://cdn.example.invalid/b.png'));
    const patch = await nextRequest(http, 'PATCH');
    expect(patch.request.body).toEqual({ avatar_url: 'https://cdn.example.invalid/b.png' });
    patch.flush(null);
    (await nextRequest(http, 'GET')).flush({ ...BACKEND_USER, avatar_url: 'https://cdn.example.invalid/b.png' });

    expect((await result).user.avatarUrl).toBe('https://cdn.example.invalid/b.png');
  });

  it('la foto sin sesión al final también es usuario no encontrado', async () => {
    const { repository, http } = setup();
    vi.spyOn(auth, 'getSession').mockResolvedValue(answer('getSession', { data: { session: null }, error: null }));

    const result = settle(firstValueFrom(repository.updateAvatar('u1', 'https://cdn.example.invalid/b.png')));
    (await nextRequest(http, 'PATCH')).flush(null);

    expect((await result).error).toEqual(new Error('auth.errors.userNotFound'));
  });
});

describe('Cambiar la contraseña desde el perfil', () => {
  const payload = { currentPassword: 'Actual-123', newPassword: 'Nueva-456' };
  const withUser = () =>
    vi.spyOn(auth, 'getUser').mockResolvedValue(answer('getUser', { data: { user: { email: 'demo@example.invalid' } }, error: null }));

  it('comprueba la contraseña actual con un inicio de sesión y fija la nueva', async () => {
    const { repository } = setup();
    withUser();
    const signIn = vi
      .spyOn(auth, 'signInWithPassword')
      .mockResolvedValue(answer('signInWithPassword', { data: { session: SUPABASE_SESSION }, error: null }));
    const update = vi.spyOn(auth, 'updateUser').mockResolvedValue(answer('updateUser', { data: {}, error: null }));

    expect(await firstValueFrom(repository.changePassword('u1', payload))).toBeUndefined();
    expect(signIn).toHaveBeenCalledExactlyOnceWith({ email: 'demo@example.invalid', password: 'Actual-123' });
    expect(update).toHaveBeenCalledExactlyOnceWith({ password: 'Nueva-456' });
  });

  it('sin usuario en Supabase es usuario no encontrado', async () => {
    const { repository } = setup();
    vi.spyOn(auth, 'getUser').mockResolvedValue(answer('getUser', { data: { user: null }, error: { message: 'x' } }));

    expect((await settle(firstValueFrom(repository.changePassword('u1', payload)))).error).toEqual(
      new Error('auth.errors.userNotFound')
    );
  });

  it('una contraseña actual equivocada no cambia nada', async () => {
    const { repository } = setup();
    withUser();
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue(
      answer('signInWithPassword', { data: { session: null }, error: { message: 'Invalid login credentials' } })
    );
    const update = vi.spyOn(auth, 'updateUser');

    expect((await settle(firstValueFrom(repository.changePassword('u1', payload)))).error).toEqual(
      new Error('auth.errors.wrongCurrentPassword')
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('si Supabase rechaza la nueva contraseña traduce el error', async () => {
    const { repository } = setup();
    withUser();
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue(
      answer('signInWithPassword', { data: { session: SUPABASE_SESSION }, error: null })
    );
    vi.spyOn(auth, 'updateUser').mockResolvedValue(answer('updateUser', { data: {}, error: { message: 'Weak password' } }));

    expect((await settle(firstValueFrom(repository.changePassword('u1', payload)))).error).toEqual(
      new Error('auth.errors.unknown')
    );
  });
});
