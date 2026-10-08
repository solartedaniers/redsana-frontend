import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RuntimeEnvironmentService } from '../runtime/runtime-environment.service';
import { SupabaseAuthRepository } from './auth-supabase.repository';
import { supabaseClient } from './supabase-client';

async function requestResetFrom(isDesktop: boolean): Promise<string | undefined> {
  TestBed.configureTestingModule({
    providers: [SupabaseAuthRepository, provideHttpClient(), { provide: RuntimeEnvironmentService, useValue: { isDesktop } }],
  });
  const reset = vi
    .spyOn(supabaseClient.auth, 'resetPasswordForEmail')
    .mockResolvedValue({ data: {}, error: null } as Awaited<ReturnType<typeof supabaseClient.auth.resetPasswordForEmail>>);
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
