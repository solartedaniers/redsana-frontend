import { Observable } from 'rxjs';
import {
  AuthSession,
  PasswordChangePayload,
  ProfileUpdatePayload,
  RegisterPayload,
} from '../models/user.model';

/**
 * Contrato de acceso a autenticación. Lo resuelve SupabaseAuthRepository;
 * cualquier otra implementación (mock, HTTP propio, etc.) solo necesita
 * implementar esta misma clase abstracta y cambiar el provider en
 * app.config.ts — ningún componente ni AuthService cambia.
 */
export abstract class AuthRepository {
  abstract signIn(email: string, password: string): Observable<AuthSession>;
  abstract signUp(payload: RegisterPayload): Observable<AuthSession>;
  abstract signOut(): Observable<void>;
  abstract requestPasswordReset(email: string): Observable<void>;
  abstract updateProfile(userId: string, payload: ProfileUpdatePayload): Observable<AuthSession>;
  abstract changePassword(userId: string, payload: PasswordChangePayload): Observable<void>;
  abstract restoreSession(): Observable<AuthSession | null>;
}
