import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthSession, UserRole } from '../models/user.model';
import { AccountSuspendedError, isSuspendedProfileResponse } from './account-suspended.error';
import { SupabaseSessionStore, SupabaseSessionTokens } from './supabase-session-store';

interface BackendUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
}

/** Los campos del perfil que guarda nuestra tabla. */
export interface BackendProfileChanges {
  full_name?: string;
  avatar_url?: string;
}

/** El perfil del usuario en el backend (/api/users/me): completa la sesión de Supabase con el rol y los datos. */
@Injectable({ providedIn: 'root' })
export class BackendProfileLoader {
  private readonly http = inject(HttpClient);
  private readonly sessions = inject(SupabaseSessionStore);
  private readonly currentUserUrl = `${environment.apiBaseUrl}/api/users/me`;

  load(tokens: SupabaseSessionTokens): Observable<AuthSession> {
    return this.http.get<BackendUser>(this.currentUserUrl).pipe(
      map((backendUser) => this.toSession(backendUser, tokens)),
      catchError((error: unknown) =>
        isSuspendedProfileResponse(error) ? this.endSuspendedSession() : throwError(() => error),
      ),
    );
  }

  update(changes: BackendProfileChanges): Observable<void> {
    return this.http.patch<void>(this.currentUserUrl, changes);
  }

  /** Cuenta suspendida: borro la sesión guardada en este equipo para no volver a intentarlo. */
  private endSuspendedSession(): Observable<never> {
    return this.sessions.endLocally().pipe(switchMap(() => throwError(() => new AccountSuspendedError())));
  }

  private toSession(backendUser: BackendUser, tokens: SupabaseSessionTokens): AuthSession {
    return {
      user: {
        id: backendUser.id,
        email: backendUser.email,
        fullName: backendUser.full_name ?? '',
        avatarUrl: backendUser.avatar_url,
        role: backendUser.role,
      },
      token: tokens.access_token,
      expiresAt: tokens.expires_at ? new Date(tokens.expires_at * 1000).toISOString() : new Date().toISOString(),
    };
  }
}
