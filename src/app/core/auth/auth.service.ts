import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthRepository } from './auth.repository';
import {
  AuthSession,
  AuthUser,
  PasswordChangePayload,
  ProfileUpdatePayload,
  RegisterPayload,
  UserRole,
} from '../models/user.model';

/**
 * Orquesta el estado de sesión de la app; delega toda llamada de datos en
 * AuthRepository para no mezclar "quién soy ahora" con "cómo se obtiene".
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly repository = inject(AuthRepository);

  private readonly session = signal<AuthSession | null>(null);
  readonly currentUser = computed<AuthUser | null>(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly role = computed<UserRole | null>(() => this.currentUser()?.role ?? null);

  restoreSession(): Observable<AuthSession | null> {
    return this.repository.restoreSession().pipe(tap((session) => this.session.set(session)));
  }

  signIn(email: string, password: string): Observable<AuthSession> {
    return this.repository.signIn(email, password).pipe(tap((session) => this.session.set(session)));
  }

  signUp(payload: RegisterPayload): Observable<AuthSession> {
    return this.repository.signUp(payload).pipe(tap((session) => this.session.set(session)));
  }

  signOut(): Observable<void> {
    return this.repository.signOut().pipe(tap(() => this.session.set(null)));
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.repository.requestPasswordReset(email);
  }

  updateProfile(payload: ProfileUpdatePayload): Observable<AuthSession> {
    const userId = this.requireUserId();
    return this.repository
      .updateProfile(userId, payload)
      .pipe(tap((session) => this.session.set(session)));
  }

  changePassword(payload: PasswordChangePayload): Observable<void> {
    return this.repository.changePassword(this.requireUserId(), payload);
  }

  private requireUserId(): string {
    const userId = this.currentUser()?.id;
    if (!userId) {
      throw new Error('No active session');
    }
    return userId;
  }
}
