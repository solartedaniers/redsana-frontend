import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ManagedUser,
  ManagedUserCreatePayload,
  ManagedUserStatus,
  ManagedUserUpdatePayload,
  UserRole,
} from '../models/user.model';
import { UsersRepository } from './users.repository';

// El backend responde 409 si la operación dejaría al admin sin acceso o a la plataforma sin admin activo,
// 404 si el usuario ya no existe y 422 con detail "email_taken" si el correo ya está registrado.
// Cualquier otro fallo usa la genérica.
export const ADMIN_LOCKOUT_ERROR_KEY = 'admin.userManagement.errors.adminLockout';
export const USER_NOT_FOUND_ERROR_KEY = 'admin.userManagement.errors.userNotFound';
export const EMAIL_TAKEN_ERROR_KEY = 'admin.userManagement.errors.emailTaken';
const EMAIL_TAKEN_DETAIL = 'email_taken';
export const GENERIC_ERROR_KEY = 'admin.userManagement.errors.generic';

interface BackendUser {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  status: ManagedUserStatus;
  created_at: string;
}

@Injectable()
export class UsersHttpRepository extends UsersRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/admin/users`;

  getUsers(): Observable<ManagedUser[]> {
    return this.http
      .get<BackendUser[]>(this.baseUrl)
      .pipe(map((users) => users.map((user) => this.toManagedUser(user))));
  }

  createUser(payload: ManagedUserCreatePayload): Observable<ManagedUser> {
    const body = { full_name: payload.fullName, email: payload.email, role: payload.role };
    return this.http.post<BackendUser>(this.baseUrl, body).pipe(
      map((user) => this.toManagedUser(user)),
      catchError((error: unknown) => this.toErrorKey(error)),
    );
  }

  updateUser(id: string, payload: ManagedUserUpdatePayload): Observable<ManagedUser> {
    const body = {
      full_name: payload.fullName,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };
    return this.http.patch<BackendUser>(`${this.baseUrl}/${id}`, body).pipe(
      map((user) => this.toManagedUser(user)),
      catchError((error: unknown) => this.toErrorKey(error)),
    );
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(catchError((error: unknown) => this.toErrorKey(error)));
  }

  private toErrorKey(error: unknown): Observable<never> {
    return throwError(() => new Error(this.errorKeyFor(error)));
  }

  private errorKeyFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return GENERIC_ERROR_KEY;
    }
    switch (error.status) {
      case HttpStatusCode.Conflict:
        return ADMIN_LOCKOUT_ERROR_KEY;
      case HttpStatusCode.NotFound:
        return USER_NOT_FOUND_ERROR_KEY;
      case HttpStatusCode.UnprocessableEntity:
        return error.error?.detail === EMAIL_TAKEN_DETAIL ? EMAIL_TAKEN_ERROR_KEY : GENERIC_ERROR_KEY;
      default:
        return GENERIC_ERROR_KEY;
    }
  }

  private toManagedUser(user: BackendUser): ManagedUser {
    return {
      id: user.id,
      fullName: user.full_name ?? '',
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
    };
  }
}
