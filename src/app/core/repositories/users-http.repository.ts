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
// y 404 si el usuario ya no existe. Cualquier otro fallo (un correo repetido hoy llega como 500) usa la genérica.
export const ADMIN_LOCKOUT_ERROR_KEY = 'admin.userManagement.errors.adminLockout';
export const USER_NOT_FOUND_ERROR_KEY = 'admin.userManagement.errors.userNotFound';
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
    const status = error instanceof HttpErrorResponse ? error.status : null;
    const key =
      status === HttpStatusCode.Conflict
        ? ADMIN_LOCKOUT_ERROR_KEY
        : status === HttpStatusCode.NotFound
          ? USER_NOT_FOUND_ERROR_KEY
          : GENERIC_ERROR_KEY;
    return throwError(() => new Error(key));
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
