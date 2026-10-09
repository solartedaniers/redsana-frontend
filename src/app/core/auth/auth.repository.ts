import { Observable } from 'rxjs';
import {
  AuthSession,
  PasswordChangePayload,
  ProfileUpdatePayload,
  RegisterPayload,
} from '../models/user.model';

/** Contrato de autenticación; hoy lo cumple SupabaseAuthRepository y se cambia en app.config.ts. */
export abstract class AuthRepository {
  abstract signIn(email: string, password: string): Observable<AuthSession>;
  abstract signUp(payload: RegisterPayload): Observable<AuthSession>;
  abstract signOut(): Observable<void>;
  abstract requestPasswordReset(email: string): Observable<void>;
  /** true si se llegó desde el enlace de recuperación con una sesión válida. */
  abstract hasRecoverySession(): Observable<boolean>;
  /** Fija la nueva contraseña con la sesión de recuperación, sin pedir la actual. */
  abstract resetPassword(newPassword: string): Observable<void>;
  abstract updateProfile(userId: string, payload: ProfileUpdatePayload): Observable<AuthSession>;
  abstract updateAvatar(userId: string, avatarUrl: string): Observable<AuthSession>;
  abstract changePassword(userId: string, payload: PasswordChangePayload): Observable<void>;
  abstract restoreSession(): Observable<AuthSession | null>;
}
