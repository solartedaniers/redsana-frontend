import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subscription,
  defer,
  filter,
  finalize,
  map,
  of,
  retry,
  switchMap,
  take,
  tap,
  throwError,
  timeout,
  timer,
} from 'rxjs';
import { AccountSuspendedError } from './account-suspended.error';
import { AuthRepository } from './auth.repository';
import { SESSION_RESTORE_CONFIG } from './session-restore.config';
import {
  AuthSession,
  AuthUser,
  PasswordChangePayload,
  ProfileUpdatePayload,
  RegisterPayload,
  UserRole,
} from '../models/user.model';

/** pending: aún no se sabe si hay sesión (el backend puede estar despertando); failed: venció la espera. */
export type SessionRestoreState = 'pending' | 'restored' | 'failed';

/** Guarda el estado de la sesión; cómo se obtienen los datos lo resuelve AuthRepository. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly repository = inject(AuthRepository);

  private readonly session = signal<AuthSession | null>(null);
  readonly currentUser = computed<AuthUser | null>(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly role = computed<UserRole | null>(() => this.currentUser()?.role ?? null);

  readonly restoreState = signal<SessionRestoreState>('pending');
  private readonly restoreState$ = toObservable(this.restoreState);
  private restoreSubscription?: Subscription;
  private readonly waitingGuards = signal(0);
  /** Hay una pantalla protegida esperando el perfil: la app muestra "Despertando el servidor…" o el fallo. */
  readonly isWaitingForSession = computed(() => this.waitingGuards() > 0);
  private readonly suspended = signal(false);
  /** La restauración encontró la cuenta suspendida: el login lo avisa al llegar. */
  readonly accountSuspended = this.suspended.asReadonly();

  // No frena el arranque: solo las pantallas protegidas esperan. Mientras Render despierta, /api/users/me falla o
  // tarda; insisto hasta el plazo y, si vence, queda "failed".
  startRestore(): void {
    this.restoreSubscription?.unsubscribe();
    this.restoreState.set('pending');
    // defer: cada reintento vuelve a leer la sesión de Supabase (el token pudo renovarse mientras tanto).
    this.restoreSubscription = defer(() => this.repository.restoreSession())
      .pipe(
        retry({
          delay: (error: unknown) =>
            isRejectedSession(error) ? throwError(() => error) : timer(SESSION_RESTORE_CONFIG.retryDelayMs),
        }),
        timeout({ first: SESSION_RESTORE_CONFIG.profileTimeoutMs }),
      )
      .subscribe({
        next: (session) => this.settle(session),
        // Sesión rechazada (cuenta suspendida, usuario dado de baja o token inválido): es lo mismo que no tener sesión.
        error: (error: unknown) => {
          if (error instanceof AccountSuspendedError) {
            this.suspended.set(true);
          }
          if (isRejectedSession(error)) {
            this.settle(null);
          } else {
            this.restoreState.set('failed');
          }
        },
      });
  }

  /** El botón de reintentar de la pantalla de fallo. */
  retryRestore(): void {
    this.startRestore();
  }

  /** Para los guards: emite una vez cuando ya se sabe si hay sesión; mientras tanto la app muestra la espera. */
  whenRestored(): Observable<void> {
    if (this.restoreState() === 'restored') {
      return of(undefined);
    }
    return defer(() => {
      this.waitingGuards.update((count) => count + 1);
      return this.restoreState$.pipe(
        filter((state) => state === 'restored'),
        take(1),
        map(() => undefined),
        finalize(() => this.waitingGuards.update((count) => count - 1)),
      );
    });
  }

  signIn(email: string, password: string): Observable<AuthSession> {
    return this.repository.signIn(email, password).pipe(tap((session) => this.settle(session)));
  }

  signUp(payload: RegisterPayload): Observable<AuthSession> {
    return this.repository.signUp(payload).pipe(tap((session) => this.settle(session)));
  }

  signOut(): Observable<void> {
    return this.repository.signOut().pipe(tap(() => this.session.set(null)));
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.repository.requestPasswordReset(email);
  }

  hasRecoverySession(): Observable<boolean> {
    return this.repository.hasRecoverySession();
  }

  /** Después de fijar la contraseña cierro la sesión de recuperación para que entre con la nueva. */
  resetPassword(newPassword: string): Observable<void> {
    return this.repository.resetPassword(newPassword).pipe(switchMap(() => this.signOut()));
  }

  updateProfile(payload: ProfileUpdatePayload): Observable<AuthSession> {
    const userId = this.requireUserId();
    return this.repository.updateProfile(userId, payload).pipe(tap((session) => this.session.set(session)));
  }

  updateAvatar(avatarUrl: string): Observable<AuthSession> {
    return this.repository
      .updateAvatar(this.requireUserId(), avatarUrl)
      .pipe(tap((session) => this.session.set(session)));
  }

  changePassword(payload: PasswordChangePayload): Observable<void> {
    return this.repository.changePassword(this.requireUserId(), payload);
  }

  /** Un inicio de sesión manual también resuelve la espera: deja de importar la restauración pendiente. */
  private settle(session: AuthSession | null): void {
    this.restoreSubscription?.unsubscribe();
    if (session) {
      this.suspended.set(false);
    }
    this.session.set(session);
    this.restoreState.set('restored');
  }

  private requireUserId(): string {
    const userId = this.currentUser()?.id;
    if (!userId) {
      throw new Error('No active session');
    }
    return userId;
  }
}

function isRejectedSession(error: unknown): boolean {
  return (
    error instanceof AccountSuspendedError ||
    (error instanceof HttpErrorResponse &&
      (error.status === HttpStatusCode.Unauthorized || error.status === HttpStatusCode.Forbidden))
  );
}
