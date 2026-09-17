import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { UsersRepository } from './users.repository';
import { ManagedUser, ManagedUserCreatePayload, ManagedUserUpdatePayload } from '../models/user.model';

const SIMULATED_LATENCY_MS = 300;

@Injectable()
export class MockUsersRepository extends UsersRepository {
  private users: ManagedUser[] = [
    {
      id: 'user-1',
      fullName: 'Familia Torres',
      email: 'hogar@redsana.app',
      role: 'standard',
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    },
    {
      id: 'admin-1',
      fullName: 'Admin RedSana',
      email: 'admin@redsana.app',
      role: 'admin',
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(),
    },
    {
      id: 'user-2',
      fullName: 'Carlos Medina',
      email: 'carlos.medina@redsana.app',
      role: 'standard',
      status: 'suspended',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
    },
  ];

  getUsers(): Observable<ManagedUser[]> {
    return of([...this.users]).pipe(delay(SIMULATED_LATENCY_MS));
  }

  createUser(payload: ManagedUserCreatePayload): Observable<ManagedUser> {
    if (this.users.some((user) => user.email === payload.email)) {
      return throwError(() => new Error('admin.userManagement.errors.emailTaken')).pipe(
        delay(SIMULATED_LATENCY_MS)
      );
    }
    const user: ManagedUser = {
      id: crypto.randomUUID(),
      fullName: payload.fullName,
      email: payload.email,
      role: payload.role,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.users = [...this.users, user];
    return of(user).pipe(delay(SIMULATED_LATENCY_MS));
  }

  updateUser(id: string, payload: ManagedUserUpdatePayload): Observable<ManagedUser> {
    const existing = this.users.find((user) => user.id === id);
    if (!existing) {
      return throwError(() => new Error('admin.userManagement.errors.userNotFound'));
    }
    const updated = { ...existing, ...payload };
    this.users = this.users.map((user) => (user.id === id ? updated : user));
    return of(updated).pipe(delay(SIMULATED_LATENCY_MS));
  }

  deleteUser(id: string): Observable<void> {
    this.users = this.users.filter((user) => user.id !== id);
    return of(undefined).pipe(delay(SIMULATED_LATENCY_MS));
  }
}
