import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import {
  AuthSession,
  PasswordChangePayload,
  ProfileUpdatePayload,
  RegisterPayload,
} from '../models/user.model';
import { AuthRepository } from './auth.repository';
import { BackendProfileLoader } from './backend-profile-loader';
import { SupabaseCredentials } from './supabase-credentials';
import { SupabaseSessionStore } from './supabase-session-store';

/** AuthRepository con Supabase Auth y el perfil del backend: solo combina las credenciales, la sesión y el perfil. */
@Injectable()
export class SupabaseAuthRepository extends AuthRepository {
  private readonly credentials = inject(SupabaseCredentials);
  private readonly sessions = inject(SupabaseSessionStore);
  private readonly profile = inject(BackendProfileLoader);

  signIn(email: string, password: string): Observable<AuthSession> {
    return this.credentials.signIn(email, password).pipe(switchMap((tokens) => this.profile.load(tokens)));
  }

  signUp(payload: RegisterPayload): Observable<AuthSession> {
    return this.credentials.signUp(payload).pipe(switchMap((tokens) => this.profile.load(tokens)));
  }

  signOut(): Observable<void> {
    return this.credentials.signOut();
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.credentials.requestPasswordReset(email);
  }

  hasRecoverySession(): Observable<boolean> {
    return this.sessions.current().pipe(map((tokens) => tokens !== null));
  }

  resetPassword(newPassword: string): Observable<void> {
    return this.credentials.updatePassword(newPassword);
  }

  updateProfile(_userId: string, payload: ProfileUpdatePayload): Observable<AuthSession> {
    return this.credentials.updateFullName(payload.fullName).pipe(
      // Supabase ya quedó actualizado; ahora sincronizo nuestra tabla para que no diverjan.
      switchMap(() => this.profile.update({ full_name: payload.fullName })),
      switchMap(() => this.reloadSession())
    );
  }

  updateAvatar(_userId: string, avatarUrl: string): Observable<AuthSession> {
    // El archivo ya está en Storage; aquí solo guardo su URL pública, igual que con full_name.
    return this.profile.update({ avatar_url: avatarUrl }).pipe(switchMap(() => this.reloadSession()));
  }

  changePassword(_userId: string, payload: PasswordChangePayload): Observable<void> {
    return this.credentials.changePassword(payload);
  }

  restoreSession(): Observable<AuthSession | null> {
    return this.sessions.current().pipe(switchMap((tokens) => (tokens ? this.profile.load(tokens) : of(null))));
  }

  private reloadSession(): Observable<AuthSession> {
    return this.sessions.current().pipe(
      switchMap((tokens) =>
        tokens ? this.profile.load(tokens) : throwError(() => new Error('auth.errors.userNotFound'))
      )
    );
  }
}
