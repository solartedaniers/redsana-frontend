import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
const TARGET_FILE = fileURLToPath(new URL('../src/environments/environment.ts', import.meta.url));

const VARIABLES = {
  supabaseUrl: 'SUPABASE_URL',
  supabaseAnonKey: 'SUPABASE_ANON_KEY',
  apiBaseUrl: 'API_BASE_URL',
};

// frontend/.env sirve para builds locales (tauri build); en Vercel no existe y
// las variables llegan del entorno, que tiene prioridad sobre el archivo.
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const missing = Object.values(VARIABLES).filter((name) => !process.env[name]);

if (missing.length === Object.keys(VARIABLES).length && existsSync(TARGET_FILE)) {
  // Sin ninguna variable definida se respeta el environment.ts escrito a mano,
  // para no romper el flujo local de quien ya lo tiene.
  console.log('[environment] no variables set, keeping existing environment.ts');
  process.exit(0);
}

if (missing.length > 0) {
  console.error(`[environment] missing variables: ${missing.join(', ')}`);
  process.exit(1);
}

const values = Object.fromEntries(
  Object.entries(VARIABLES).map(([key, name]) => [key, process.env[name].replace(/\/+$/, '')]),
);

writeFileSync(TARGET_FILE, `export const environment = ${JSON.stringify(values, null, 2)};\n`);
console.log(`[environment] generated for API ${values.apiBaseUrl}`);
