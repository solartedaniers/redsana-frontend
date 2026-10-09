import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Un solo cliente compartido para no abrir más de una conexión por pestaña.
export const supabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
