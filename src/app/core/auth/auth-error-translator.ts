import { Injectable } from '@angular/core';

/** Lo que importa del AuthError de Supabase; code puede faltar (errores sin respuesta HTTP o servidores viejos). */
export interface SupabaseAuthErrorLike {
  readonly code?: string;
  readonly message?: string;
}

// Solo los códigos que equivalen a los textos de abajo: email_exists (cambio de correo) no se mapea porque hoy cae en
// 'unknown' y mapearlo cambiaría lo que ve el usuario.
const KEY_BY_CODE: Readonly<Record<string, string>> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  user_already_exists: 'auth.errors.emailTaken',
};

/** Traduce el error de Supabase a la clave i18n que muestran los formularios: por código y, si no hay, por texto. */
@Injectable({ providedIn: 'root' })
export class AuthErrorTranslator {
  toKey(error: SupabaseAuthErrorLike | null | undefined): string {
    const code = error?.code;
    if (code && Object.hasOwn(KEY_BY_CODE, code)) {
      return KEY_BY_CODE[code];
    }
    const message = error?.message;
    if (message?.includes('Invalid login credentials')) {
      return 'auth.errors.invalidCredentials';
    }
    if (message?.includes('already registered')) {
      return 'auth.errors.emailTaken';
    }
    return 'auth.errors.unknown';
  }
}
