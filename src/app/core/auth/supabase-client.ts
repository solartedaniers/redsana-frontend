import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Cliente único compartido por SupabaseAuthRepository y el interceptor HTTP,
// para no abrir más de una conexión/realtime-socket por sesión de navegador.
export const supabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
