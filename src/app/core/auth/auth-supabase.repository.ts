import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthSession,
  AuthUser,
  PasswordChangePayload,
  ProfileUpdatePayload,
  RegisterPayload,
  UserRole,
} from '../models/user.model';
import { AuthRepository } from './auth.repository';
import { supabaseClient } from './supabase-client';

interface BackendUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
}

@Injectable()
export class SupabaseAuthRepository extends AuthRepository {
  private readonly http = inject(HttpClient);

  signIn(email: string, password: string): Observable<AuthSession> {
    return from(supabaseClient.auth.signInWithPassword({ email, password })).pipe(
      switchMap(({ data, error }) => {
        if (error || !data.session) {
          return throwError(() => new Error(this.mapAuthError(error?.message)));
        }
        return this.buildSession(data.session.access_token, data.session.expires_at);
      })
    );
  }

  signUp(payload: RegisterPayload): Observable<AuthSession> {
    return from(
      supabaseClient.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: { data: { full_name: payload.fullName } },
      })
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) {
          return throwError(() => new Error(this.mapAuthError(error.message)));
        }
        if (!data.session) {
          // Confirmación de correo habilitada en Supabase: no hay sesión hasta que el usuario confirme.
          return throwError(() => new Error('auth.errors.confirmationRequired'));
        }
        return this.buildSession(data.session.access_token, data.session.expires_at);
      })
    );
  }

  signOut(): Observable<void> {
    return from(supabaseClient.auth.signOut()).pipe(map(() => undefined));
  }

  requestPasswordReset(email: string): Observable<void> {
    return from(
      supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/login`,
      })
    ).pipe(map(() => undefined));
  }

  updateProfile(_userId: string, payload: ProfileUpdatePayload): Observable<AuthSession> {
    return from(
      supabaseClient.auth.updateUser({ email: payload.email, data: { full_name: payload.fullName } })
    ).pipe(
      switchMap(({ error }) => {
        if (error) {
          return throwError(() => new Error(this.mapAuthError(error.message)));
        }
        // Supabase Auth ya quedo actualizado; sincroniza la tabla propia para que no diverja.
        return this.http.patch<void>(`${environment.apiBaseUrl}/api/me`, {
          full_name: payload.fullName,
          email: payload.email,
        });
      }),
      switchMap(() => from(supabaseClient.auth.getSession())),
      switchMap(({ data }) => {
        if (!data.session) {
          return throwError(() => new Error('auth.errors.userNotFound'));
        }
        return this.buildSession(data.session.access_token, data.session.expires_at);
      })
    );
  }

  updateAvatar(_userId: string, avatarUrl: string): Observable<AuthSession> {
    // El archivo ya está subido a Supabase Storage en este punto: aquí solo se
    // persiste la URL pública resultante, mismo patrón que full_name/email.
    return this.http.patch<void>(`${environment.apiBaseUrl}/api/me`, { avatar_url: avatarUrl }).pipe(
      switchMap(() => from(supabaseClient.auth.getSession())),
      switchMap(({ data }) => {
        if (!data.session) {
          return throwError(() => new Error('auth.errors.userNotFound'));
        }
        return this.buildSession(data.session.access_token, data.session.expires_at);
      })
    );
  }

  changePassword(_userId: string, payload: PasswordChangePayload): Observable<void> {
    return from(supabaseClient.auth.getUser()).pipe(
      switchMap(({ data, error }) => {
        if (error || !data.user?.email) {
          return throwError(() => new Error('auth.errors.userNotFound'));
        }
        return from(
          supabaseClient.auth.signInWithPassword({
            email: data.user.email,
            password: payload.currentPassword,
          })
        );
      }),
      switchMap(({ error }) => {
        if (error) {
          return throwError(() => new Error('auth.errors.wrongCurrentPassword'));
        }
        return from(supabaseClient.auth.updateUser({ password: payload.newPassword }));
      }),
      switchMap(({ error }) => {
        if (error) {
          return throwError(() => new Error(this.mapAuthError(error.message)));
        }
        return of(undefined);
      })
    );
  }

  restoreSession(): Observable<AuthSession | null> {
    return from(supabaseClient.auth.getSession()).pipe(
      switchMap(({ data }) => {
        if (!data.session) {
          return of(null);
        }
        return this.buildSession(data.session.access_token, data.session.expires_at);
      })
    );
  }

  private buildSession(accessToken: string, expiresAt: number | undefined): Observable<AuthSession> {
    return this.http.get<BackendUser>(`${environment.apiBaseUrl}/api/me`).pipe(
      map((backendUser) => this.toSession(backendUser, accessToken, expiresAt))
    );
  }

  private toSession(backendUser: BackendUser, accessToken: string, expiresAt: number | undefined): AuthSession {
    const user: AuthUser = {
      id: backendUser.id,
      email: backendUser.email,
      fullName: backendUser.full_name ?? '',
      avatarUrl: backendUser.avatar_url,
      role: backendUser.role,
    };
    return {
      user,
      token: accessToken,
      expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : new Date().toISOString(),
    };
  }

  private mapAuthError(message: string | undefined): string {
    if (message?.includes('Invalid login credentials')) {
      return 'auth.errors.invalidCredentials';
    }
    if (message?.includes('already registered')) {
      return 'auth.errors.emailTaken';
    }
    return 'auth.errors.unknown';
  }
}
