import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ManagedUser, ManagedUserCreatePayload, ManagedUserStatus, ManagedUserUpdatePayload, UserRole } from '../models/user.model';
import { UsersRepository } from './users.repository';

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
    return this.http.get<BackendUser[]>(this.baseUrl).pipe(map((users) => users.map((user) => this.toManagedUser(user))));
  }

  createUser(payload: ManagedUserCreatePayload): Observable<ManagedUser> {
    const body = { full_name: payload.fullName, email: payload.email, role: payload.role };
    return this.http.post<BackendUser>(this.baseUrl, body).pipe(map((user) => this.toManagedUser(user)));
  }

  updateUser(id: string, payload: ManagedUserUpdatePayload): Observable<ManagedUser> {
    const body = {
      full_name: payload.fullName,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };
    return this.http.patch<BackendUser>(`${this.baseUrl}/${id}`, body).pipe(map((user) => this.toManagedUser(user)));
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
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
