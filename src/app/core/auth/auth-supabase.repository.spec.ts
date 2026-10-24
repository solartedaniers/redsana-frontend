import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RuntimeEnvironmentService } from '../runtime/runtime-environment.service';
import { AccountSuspendedError } from './account-suspended.error';
import { SupabaseAuthRepository } from './auth-supabase.repository';
import { supabaseClient } from './supabase-client';

async function requestResetFrom(isDesktop: boolean): Promise<string | undefined> {
  TestBed.configureTestingModule({
    providers: [
      SupabaseAuthRepository,
      provideHttpClient(),
      { provide: RuntimeEnvironmentService, useValue: { isDesktop } },
    ],
  });
  const reset = vi
    .spyOn(supabaseClient.auth, 'resetPasswordForEmail')
    .mockResolvedValue({ data: {}, error: null } as Awaited<
      ReturnType<typeof supabaseClient.auth.resetPasswordForEmail>
    >);
  await firstValueFrom(TestBed.inject(SupabaseAuthRepository).requestPasswordReset('user@redsana.dev'));
  return reset.mock.calls[0][1]?.redirectTo;
}

describe('SupabaseAuthRepository.requestPasswordReset', () => {
  afterEach(() => vi.restoreAllMocks());

  it('desde el escritorio el correo enlaza a la web pública (WEB_APP_URL)', async () => {
    expect(await requestResetFrom(true)).toBe(`${environment.webAppUrl}/auth/reset-password`);
  });

  it('desde la web enlaza al mismo origen en el que está el usuario', async () => {
    expect(await requestResetFrom(false)).toBe(`${window.location.origin}/auth/reset-password`);
  });
});

type GetSessionResult = Awaited<ReturnType<typeof supabaseClient.auth.getSession>>;
type SignOutResult = Awaited<ReturnType<typeof supabaseClient.auth.signOut>>;

/** Restaura una sesión guardada y responde /api/users/me con el estado indicado; devuelve el error y el signOut. */
async function restoreWithProfileStatus(
  status: number,
): Promise<{ error: unknown; signOut: ReturnType<typeof vi.fn> }> {
  TestBed.configureTestingModule({
    providers: [
      SupabaseAuthRepository,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RuntimeEnvironmentService, useValue: { isDesktop: false } },
    ],
  });
  vi.spyOn(supabaseClient.auth, 'getSession').mockResolvedValue({
    data: { session: { access_token: 'token', expires_at: 0 } },
    error: null,
  } as unknown as GetSessionResult);
  const signOut = vi.spyOn(supabaseClient.auth, 'signOut').mockResolvedValue({ error: null } as SignOutResult);
  const result = firstValueFrom(TestBed.inject(SupabaseAuthRepository).restoreSession()).catch(
    (error: unknown) => error,
  );
  await vi.waitFor(() =>
    TestBed.inject(HttpTestingController)
      .expectOne(`${environment.apiBaseUrl}/api/users/me`)
      .flush({ detail: 'x' }, { status, statusText: 'x' }),
  );
  return { error: await result, signOut: signOut as unknown as ReturnType<typeof vi.fn> };
}

describe('SupabaseAuthRepository con la cuenta suspendida', () => {
  afterEach(() => vi.restoreAllMocks());

  it('un 403 de /api/users/me cierra la sesión local y avisa que la cuenta está suspendida', async () => {
    const { error, signOut } = await restoreWithProfileStatus(403);

    expect(error).toBeInstanceOf(AccountSuspendedError);
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
  });

  it('otros errores (el backend despertando) no cierran la sesión y siguen siendo errores HTTP', async () => {
    const { error, signOut } = await restoreWithProfileStatus(503);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(signOut).not.toHaveBeenCalled();
  });
});
