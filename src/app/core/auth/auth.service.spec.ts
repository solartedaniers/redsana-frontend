import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthSession } from '../models/user.model';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

/** Lo que AuthService guarda o borra de la sesión en cada operación; el repositorio está simulado. */
const session = (fullName = 'Demo'): AuthSession => ({
  user: { id: 'u1', email: 'demo@example.invalid', fullName, avatarUrl: null, role: 'standard' },
  token: 'token',
  expiresAt: new Date(0).toISOString(),
});

function setup() {
  const repository = {
    signIn: vi.fn(() => of(session())),
    signUp: vi.fn(() => of(session())),
    signOut: vi.fn(() => of(undefined)),
    requestPasswordReset: vi.fn(() => of(undefined)),
    hasRecoverySession: vi.fn(() => of(true)),
    resetPassword: vi.fn(() => of(undefined)),
    updateProfile: vi.fn(() => of(session('Otro'))),
    updateAvatar: vi.fn(() => of(session())),
    changePassword: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({ providers: [{ provide: AuthRepository, useValue: repository }] });
  return { auth: TestBed.inject(AuthService), repository };
}

describe('AuthService', () => {
  it('registrarse deja la sesión iniciada', async () => {
    const { auth } = setup();

    await firstValueFrom(auth.signUp({ fullName: 'Demo', email: 'demo@example.invalid', password: 'x' }));

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.restoreState()).toBe('restored');
  });

  it('cerrar sesión la borra', async () => {
    const { auth } = setup();
    await firstValueFrom(auth.signIn('demo@example.invalid', 'x'));

    await firstValueFrom(auth.signOut());

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
  });

  it('recuperar la contraseña delega en el repositorio', async () => {
    const { auth, repository } = setup();

    await firstValueFrom(auth.requestPasswordReset('demo@example.invalid'));

    expect(repository.requestPasswordReset).toHaveBeenCalledExactlyOnceWith('demo@example.invalid');
    expect(await firstValueFrom(auth.hasRecoverySession())).toBe(true);
  });

  it('tras fijar la nueva contraseña cierra la sesión de recuperación', async () => {
    const { auth, repository } = setup();
    await firstValueFrom(auth.signIn('demo@example.invalid', 'x'));

    await firstValueFrom(auth.resetPassword('Nueva-123'));

    expect(repository.resetPassword).toHaveBeenCalledExactlyOnceWith('Nueva-123');
    expect(repository.signOut).toHaveBeenCalledOnce();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('perfil, foto y contraseña usan el usuario de la sesión', async () => {
    const { auth, repository } = setup();
    await firstValueFrom(auth.signIn('demo@example.invalid', 'x'));

    await firstValueFrom(auth.updateProfile({ fullName: 'Otro' }));
    await firstValueFrom(auth.updateAvatar('https://cdn.example.invalid/a.png'));
    await firstValueFrom(auth.changePassword({ currentPassword: 'a', newPassword: 'b' }));

    expect(repository.updateProfile).toHaveBeenCalledWith('u1', { fullName: 'Otro' });
    expect(repository.updateAvatar).toHaveBeenCalledWith('u1', 'https://cdn.example.invalid/a.png');
    expect(repository.changePassword).toHaveBeenCalledWith('u1', { currentPassword: 'a', newPassword: 'b' });
    expect(auth.currentUser()?.fullName).toBe('Demo');
  });

  it('sin sesión, cambiar el perfil falla antes de llamar al repositorio', () => {
    const { auth, repository } = setup();

    expect(() => auth.updateProfile({ fullName: 'X' })).toThrow('No active session');
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });
});
