import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { AuthRepository } from './auth.repository';
import {
  AuthSession,
  AuthUser,
  PasswordChangePayload,
  ProfileUpdatePayload,
  RegisterPayload,
} from '../models/user.model';

const SESSION_STORAGE_KEY = 'redsana-session';
const SIMULATED_LATENCY_MS = 400;

interface StoredAccount {
  user: AuthUser;
  password: string;
}

// Dos cuentas semilla (hogar / admin) para poder probar ambos flujos de rol
// sin backend real.
const SEED_ACCOUNTS: StoredAccount[] = [
  {
    user: { id: 'user-1', email: 'hogar@redsana.app', fullName: 'Familia Torres', role: 'standard' },
    password: 'redsana123',
  },
  {
    user: { id: 'admin-1', email: 'admin@redsana.app', fullName: 'Admin RedSana', role: 'admin' },
    password: 'redsana123',
  },
];

@Injectable()
export class MockAuthRepository extends AuthRepository {
  private accounts: StoredAccount[] = [...SEED_ACCOUNTS];

  signIn(email: string, password: string): Observable<AuthSession> {
    const account = this.accounts.find((a) => a.user.email === email);
    if (!account || account.password !== password) {
      return throwError(() => new Error('auth.errors.invalidCredentials')).pipe(
        delay(SIMULATED_LATENCY_MS)
      );
    }
    return of(this.buildSession(account.user)).pipe(delay(SIMULATED_LATENCY_MS));
  }

  signUp(payload: RegisterPayload): Observable<AuthSession> {
    if (this.accounts.some((a) => a.user.email === payload.email)) {
      return throwError(() => new Error('auth.errors.emailTaken')).pipe(delay(SIMULATED_LATENCY_MS));
    }
    const user: AuthUser = {
      id: crypto.randomUUID(),
      email: payload.email,
      fullName: payload.fullName,
      role: 'standard',
    };
    this.accounts.push({ user, password: payload.password });
    return of(this.buildSession(user)).pipe(delay(SIMULATED_LATENCY_MS));
  }

  signOut(): Observable<void> {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return of(undefined).pipe(delay(SIMULATED_LATENCY_MS / 2));
  }

  requestPasswordReset(_email: string): Observable<void> {
    // Simulado: un backend real dispararía un correo con enlace firmado.
    return of(undefined).pipe(delay(SIMULATED_LATENCY_MS));
  }

  updateProfile(userId: string, payload: ProfileUpdatePayload): Observable<AuthSession> {
    const account = this.accounts.find((a) => a.user.id === userId);
    if (!account) {
      return throwError(() => new Error('auth.errors.userNotFound'));
    }
    account.user = { ...account.user, ...payload };
    return of(this.buildSession(account.user)).pipe(delay(SIMULATED_LATENCY_MS));
  }

  changePassword(userId: string, payload: PasswordChangePayload): Observable<void> {
    const account = this.accounts.find((a) => a.user.id === userId);
    if (!account || account.password !== payload.currentPassword) {
      return throwError(() => new Error('auth.errors.wrongCurrentPassword')).pipe(
        delay(SIMULATED_LATENCY_MS)
      );
    }
    account.password = payload.newPassword;
    return of(undefined).pipe(delay(SIMULATED_LATENCY_MS));
  }

  restoreSession(): Observable<AuthSession | null> {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return of(raw ? (JSON.parse(raw) as AuthSession) : null);
  }

  private buildSession(user: AuthUser): AuthSession {
    const session: AuthSession = {
      user,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return session;
  }
}
