import { Injectable } from '@angular/core';
import { Session, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { supabaseClient } from './supabase-client';

/** Lo que hace falta de la sesión de Supabase para pedir el perfil al backend. */
export type SupabaseSessionTokens = Pick<Session, 'access_token' | 'expires_at'>;

/** La sesión que supabase-js guarda en este equipo. */
@Injectable({ providedIn: 'root' })
export class SupabaseSessionStore {
  /** La sesión guardada, o null. getSession espera a que supabase-js termine de leer el token que trae un enlace. */
  current(): Observable<SupabaseSessionTokens | null> {
    return from(supabaseClient.auth.getSession()).pipe(
      map(({ data, error }) => {
        // Token vencido y sin red: supabase-js conserva la sesión pero devuelve null. No es "sin sesión": se reintenta.
        if (isAuthRetryableFetchError(error)) {
          throw error;
        }
        return data.session;
      }),
    );
  }

  /** Borra la sesión de este equipo sin pedir nada a la red. */
  endLocally(): Observable<void> {
    return from(supabaseClient.auth.signOut({ scope: 'local' })).pipe(map(() => undefined));
  }
}
