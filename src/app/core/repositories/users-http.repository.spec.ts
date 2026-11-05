import { HttpErrorResponse, HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import en from '../../../../public/assets/i18n/en.json';
import es from '../../../../public/assets/i18n/es.json';
import {
  ADMIN_LOCKOUT_ERROR_KEY,
  EMAIL_TAKEN_ERROR_KEY,
  GENERIC_ERROR_KEY,
  USER_NOT_FOUND_ERROR_KEY,
  UsersHttpRepository,
} from './users-http.repository';

const NEW_USER = { fullName: 'Yo', email: 'yo@example.invalid', role: 'standard' } as const;

function failWith(
  status: HttpStatusCode,
  call: (repository: UsersHttpRepository) => Observable<unknown>,
  body: object = { detail: 'x' },
): unknown {
  TestBed.configureTestingModule({ providers: [UsersHttpRepository, provideHttpClient(), provideHttpClientTesting()] });
  let received: unknown;
  call(TestBed.inject(UsersHttpRepository)).subscribe({ error: (error: unknown) => (received = error) });
  TestBed.inject(HttpTestingController)
    .expectOne((req) => req.url.includes('/api/admin/users'))
    .flush(body, { status, statusText: 'x' });
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

  it('un 404 se traduce a usuario no encontrado', () => {
    const error = failWith(HttpStatusCode.NotFound, (repository) => repository.deleteUser('nadie'));

    expect((error as Error).message).toBe(USER_NOT_FOUND_ERROR_KEY);
  });

  it('un error al crear (un correo repetido llega como 500) usa la clave genérica sin la URL ni el texto HTTP', () => {
    const error = failWith(HttpStatusCode.InternalServerError, (repository) =>
      repository.createUser({ fullName: 'Yo', email: 'yo@example.invalid', role: 'standard' }),
    );

    expect(error).not.toBeInstanceOf(HttpErrorResponse);
    expect((error as Error).message).toBe(GENERIC_ERROR_KEY);
  });

  it('un 422 email_taken al crear muestra que el correo ya está registrado', () => {
    const error = failWith(HttpStatusCode.UnprocessableEntity, (repository) => repository.createUser(NEW_USER), {
      detail: 'email_taken',
    });

    expect((error as Error).message).toBe(EMAIL_TAKEN_ERROR_KEY);
  });

  it('un 422 de validación sigue usando la clave genérica', () => {
    const error = failWith(HttpStatusCode.UnprocessableEntity, (repository) => repository.createUser(NEW_USER), {
      detail: [{ loc: ['body', 'email'], msg: 'Field required' }],
    });

    expect((error as Error).message).toBe(GENERIC_ERROR_KEY);
  });

  it('las claves de error existen en español y en inglés', () => {
    for (const key of [ADMIN_LOCKOUT_ERROR_KEY, USER_NOT_FOUND_ERROR_KEY, EMAIL_TAKEN_ERROR_KEY, GENERIC_ERROR_KEY]) {
      const name = key.split('.').at(-1) as keyof typeof es.admin.userManagement.errors;
      expect(es.admin.userManagement.errors[name]).toBeTruthy();
      expect(en.admin.userManagement.errors[name]).toBeTruthy();
    }
  });
});
