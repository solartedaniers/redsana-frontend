// Corre en `tauri build` después de `npm run build`: falla si la CSP del escritorio no permite la API, Supabase o el
// /health de la IA del environment.ts que se acaba de generar. Si no, el instalador saldría sin poder conectarse.
// Tiene en cuenta un --config de la línea de comandos (Tauri lo pasa en TAURI_CONFIG).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const environment = read('../src/environments/environment.ts');
const value = (key) => environment.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']*)["']`))?.[1] ?? '';

const config = JSON.parse(read('../src-tauri/tauri.conf.json'));
const override = process.env.TAURI_CONFIG ? JSON.parse(process.env.TAURI_CONFIG) : {};
const csp = { ...config.app.security.csp, ...override.app?.security?.csp };
const sources = (directive) => (csp[directive] ?? '').split(/\s+/);

const required = [
  ['connect-src', value('apiBaseUrl')],
  ['connect-src', value('supabaseUrl')],
  ['img-src', value('supabaseUrl')], // fotos de perfil (Storage)
  ['connect-src', value('aiServicePublicUrl')], // vacía = sin despertar la IA desde el cliente
].filter(([, url]) => url);

const missing = required
  .map(([directive, url]) => [directive, new URL(url).origin])
  .filter(([directive, origin]) => !sources(directive).includes(origin));

if (missing.length > 0) {
  for (const [directive, origin] of missing) {
    console.error(`[tauri-csp] ${origin} is missing from ${directive} in src-tauri/tauri.conf.json`);
  }
  process.exit(1);
}
console.log('[tauri-csp] OK');
