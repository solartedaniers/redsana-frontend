import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
const TARGET_FILE = fileURLToPath(new URL('../src/environments/environment.ts', import.meta.url));

const VARIABLES = {
  supabaseUrl: 'SUPABASE_URL',
  supabaseAnonKey: 'SUPABASE_ANON_KEY',
  apiBaseUrl: 'API_BASE_URL',
  desktopDownloadUrl: 'DESKTOP_DOWNLOAD_URL',
  webAppUrl: 'WEB_APP_URL',
};

// Optional: they have documented defaults so an existing deployment keeps
// building before these are added to its environment.
const OPTIONAL_VARIABLES = {
  // Vacía desactiva el despertar de la IA desde el cliente.
  aiServicePublicUrl: { name: 'AI_SERVICE_PUBLIC_URL', fallback: '' },
};

// Requisito académico: credenciales de ejemplo precargadas en el login. Apagado por defecto y sin valores en
// el repo; con el interruptor apagado no escribo el correo ni la contraseña aunque estén definidos.
const DEMO_LOGIN_VARIABLES = {
  enabled: 'DEMO_LOGIN_ENABLED',
  email: 'DEMO_LOGIN_EMAIL',
  password: 'DEMO_LOGIN_PASSWORD',
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

// El botón de descarga es un enlace directo: si apunta a la página del release, un clic lleva a GitHub en vez de bajar
// el instalador. Mejor que falle el build (y siga el despliegue anterior) que publicar eso.
if (!new URL(process.env.DESKTOP_DOWNLOAD_URL).pathname.toLowerCase().endsWith('.exe')) {
  console.error('[environment] DESKTOP_DOWNLOAD_URL must be the installer .exe (…/releases/latest/download/<name>.exe)');
  process.exit(1);
}

const demoLogin = readDemoLogin();

const values = Object.fromEntries([
  ...Object.entries(VARIABLES).map(([key, name]) => [key, process.env[name].replace(/\/+$/, '')]),
  ...Object.entries(OPTIONAL_VARIABLES).map(([key, { name, fallback }]) => [
    key,
    (process.env[name] || fallback).replace(/\/+$/, ''),
  ]),
  ['demoLogin', demoLogin],
]);

writeFileSync(TARGET_FILE, `export const environment = ${JSON.stringify(values, null, 2)};\n`);
console.log(`[environment] generated for API ${values.apiBaseUrl} (demo login ${demoLogin.enabled ? 'on' : 'off'})`);

function readDemoLogin() {
  const enabled = (process.env[DEMO_LOGIN_VARIABLES.enabled] || '').trim().toLowerCase() === 'true';
  if (!enabled) {
    return { enabled: false, email: '', password: '' };
  }
  // Sin recortar barras ni espacios internos: la contraseña debe llegar tal cual.
  const email = (process.env[DEMO_LOGIN_VARIABLES.email] || '').trim();
  const password = process.env[DEMO_LOGIN_VARIABLES.password] || '';
  const missingDemo = [!email && DEMO_LOGIN_VARIABLES.email, !password && DEMO_LOGIN_VARIABLES.password].filter(
    Boolean,
  );
  if (missingDemo.length > 0) {
    console.error(`[environment] ${DEMO_LOGIN_VARIABLES.enabled}=true but missing: ${missingDemo.join(', ')}`);
    process.exit(1);
  }
  return { enabled: true, email, password };
}
