import { Injectable, inject } from '@angular/core';
import { Observable, from, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PasswordChangePayload, RegisterPayload } from '../models/user.model';
import { APP_PATHS } from '../routing/app-paths';
import { RuntimeEnvironmentService } from '../runtime/runtime-environment.service';
import { AuthErrorTranslator } from './auth-error-translator';
import { supabaseClient } from './supabase-client';
import { SupabaseSessionTokens } from './supabase-session-store';

/** Lo que se hace con las credenciales en Supabase Auth: entrar, registrarse, salir y cambiar la contraseña o el nombre. */
@Injectable({ providedIn: 'root' })
export class SupabaseCredentials {
  private readonly errors = inject(AuthErrorTranslator);
  private readonly isDesktop = inject(RuntimeEnvironmentService).isDesktop;

  signIn(email: string, password: string): Observable<SupabaseSessionTokens> {
    return from(supabaseClient.auth.signInWithPassword({ email, password })).pipe(
      switchMap(({ data, error }) =>
        error || !data.session ? throwError(() => new Error(this.errors.toKey(error?.message))) : of(data.session)
      )
    );
  }

  signUp(payload: RegisterPayload): Observable<SupabaseSessionTokens> {
    return from(
      supabaseClient.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: { data: { full_name: payload.fullName } },
      })
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) {
          return throwError(() => new Error(this.errors.toKey(error.message)));
        }
        if (!data.session) {
          // Con confirmación de correo activa en Supabase no hay sesión hasta que el usuario confirme.
          return throwError(() => new Error('auth.errors.confirmationRequired'));
        }
        return of(data.session);
      })
    );
  }

  signOut(): Observable<void> {
    return from(supabaseClient.auth.signOut()).pipe(map(() => undefined));
  }

  requestPasswordReset(email: string): Observable<void> {
    return from(
      supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${this.recoveryOrigin()}${APP_PATHS.resetPassword}`,
      })
    ).pipe(map(() => undefined));
  }

  /** Con la sesión actual (la de recuperación o la normal), sin pedir la contraseña anterior. */
  updatePassword(newPassword: string): Observable<void> {
    return from(supabaseClient.auth.updateUser({ password: newPassword })).pipe(
      switchMap(({ error }) => (error ? throwError(() => new Error(this.errors.toKey(error.message))) : of(undefined)))
    );
  }

  /** Comprueba la contraseña actual con un inicio de sesión antes de fijar la nueva. */
  changePassword(payload: PasswordChangePayload): Observable<void> {
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
      switchMap(({ error }) =>
        error ? throwError(() => new Error('auth.errors.wrongCurrentPassword')) : this.updatePassword(payload.newPassword)
      )
    );
  }

  updateFullName(fullName: string): Observable<void> {
    return from(supabaseClient.auth.updateUser({ data: { full_name: fullName } })).pipe(
      switchMap(({ error }) => (error ? throwError(() => new Error(this.errors.toKey(error.message))) : of(undefined)))
    );
  }

  /** El enlace del correo se abre en el navegador, donde tauri.localhost no existe: uso la web pública. */
  private recoveryOrigin(): string {
    return this.isDesktop ? environment.webAppUrl : window.location.origin;
  }
}
