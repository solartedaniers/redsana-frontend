import { Injectable } from '@angular/core';

/** Traduce el mensaje de error de Supabase a la clave i18n que muestran los formularios. */
@Injectable({ providedIn: 'root' })
export class AuthErrorTranslator {
  toKey(message: string | undefined): string {
    if (message?.includes('Invalid login credentials')) {
      return 'auth.errors.invalidCredentials';
    }
    if (message?.includes('already registered')) {
      return 'auth.errors.emailTaken';
    }
    return 'auth.errors.unknown';
  }
}
