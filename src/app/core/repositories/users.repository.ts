import { Observable } from 'rxjs';
import { ManagedUser, ManagedUserCreatePayload, ManagedUserUpdatePayload } from '../models/user.model';

export abstract class UsersRepository {
  abstract getUsers(): Observable<ManagedUser[]>;
  abstract createUser(payload: ManagedUserCreatePayload): Observable<ManagedUser>;
  abstract updateUser(id: string, payload: ManagedUserUpdatePayload): Observable<ManagedUser>;
  abstract deleteUser(id: string): Observable<void>;
}
