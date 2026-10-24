import { Injectable } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { supabaseClient } from './supabase-client';

/** Lo que hace falta de la sesión de Supabase para pedir el perfil al backend. */
export type SupabaseSessionTokens = Pick<Session, 'access_token' | 'expires_at'>;

/** La sesión que supabase-js guarda en este equipo. */
@Injectable({ providedIn: 'root' })
export class SupabaseSessionStore {
  /** La sesión guardada, o null. getSession espera a que supabase-js termine de leer el token que trae un enlace. */
  current(): Observable<SupabaseSessionTokens | null> {
    return from(supabaseClient.auth.getSession()).pipe(map(({ data }) => data.session));
  }

  /** Borra la sesión de este equipo sin pedir nada a la red. */
  endLocally(): Observable<void> {
    return from(supabaseClient.auth.signOut({ scope: 'local' })).pipe(map(() => undefined));
  }
}
