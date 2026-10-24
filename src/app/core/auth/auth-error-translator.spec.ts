import { AuthErrorTranslator } from './auth-error-translator';

describe('AuthErrorTranslator', () => {
  const translator = new AuthErrorTranslator();

  it('traduce por código aunque el texto de Supabase cambie', () => {
    expect(translator.toKey({ code: 'invalid_credentials', message: 'Credenciales inválidas' })).toBe(
      'auth.errors.invalidCredentials',
    );
    expect(translator.toKey({ code: 'user_already_exists', message: 'Ya existe' })).toBe('auth.errors.emailTaken');
  });

  it('sin código (servidor viejo o error de red) sigue usando el texto de siempre', () => {
    expect(translator.toKey({ message: 'Invalid login credentials' })).toBe('auth.errors.invalidCredentials');
    expect(translator.toKey({ message: 'User already registered' })).toBe('auth.errors.emailTaken');
  });

  it('un código desconocido no tapa el texto conocido', () => {
    expect(translator.toKey({ code: 'unexpected_failure', message: 'Invalid login credentials' })).toBe(
      'auth.errors.invalidCredentials',
    );
  });

  it('email_exists queda como antes (desconocido): mapearlo cambiaría lo que ve el usuario', () => {
    expect(
      translator.toKey({
        code: 'email_exists',
        message: 'A user with this email address has already been registered',
      }),
    ).toBe('auth.errors.unknown');
  });

  it('sin error, o con un código que coincide con una propiedad de Object, da desconocido', () => {
    expect(translator.toKey(null)).toBe('auth.errors.unknown');
    expect(translator.toKey(undefined)).toBe('auth.errors.unknown');
    expect(translator.toKey({ code: 'constructor' })).toBe('auth.errors.unknown');
  });
});
