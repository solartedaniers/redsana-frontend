import { HttpErrorResponse, HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { ADMIN_LOCKOUT_ERROR_KEY, UsersHttpRepository } from './users-http.repository';

function failWith(status: HttpStatusCode, call: (repository: UsersHttpRepository) => Observable<unknown>): unknown {
  TestBed.configureTestingModule({ providers: [UsersHttpRepository, provideHttpClient(), provideHttpClientTesting()] });
  let received: unknown;
  call(TestBed.inject(UsersHttpRepository)).subscribe({ error: (error: unknown) => (received = error) });
  TestBed.inject(HttpTestingController)
    .expectOne((req) => req.url.includes('/api/admin/users/'))
    .flush({ detail: 'x' }, { status, statusText: 'x' });
  return received;
}

describe('UsersHttpRepository', () => {
  it('un 409 al editar se traduce a la clave de i18n del bloqueo del admin', () => {
    const error = failWith(HttpStatusCode.Conflict, (repository) =>
      repository.updateUser('me', { fullName: 'Yo', email: 'yo@example.invalid', role: 'standard' }),
    );

    expect((error as Error).message).toBe(ADMIN_LOCKOUT_ERROR_KEY);
  });

  it('un 409 al borrar también', () => {
    const error = failWith(HttpStatusCode.Conflict, (repository) => repository.deleteUser('me'));

    expect((error as Error).message).toBe(ADMIN_LOCKOUT_ERROR_KEY);
  });

  it('otros errores pasan tal cual', () => {
    const error = failWith(HttpStatusCode.NotFound, (repository) => repository.deleteUser('nadie'));

    expect(error).toBeInstanceOf(HttpErrorResponse);
  });
});
