// Corre en `tauri build` después de `npm run build` (solo para el escritorio; Vercel no lo usa):
// 1. Falla si la CSP del escritorio no permite la API, Supabase o el /health de la IA del environment.ts que se acaba
//    de generar: si no, el instalador saldría sin poder conectarse. Tiene en cuenta un --config de la línea de
//    comandos (Tauri lo pasa en TAURI_CONFIG).
// 2. Deja index.html igual a index.csr.html. Tauri sirve index.html para toda ruta sin archivo (al recargar con F5),
//    y el prerenderizado de la landing trae atributos style del SSR que la CSP bloquea; el escritorio no hidrata,
//    así que nunca lo necesita.
import { copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = (path) => fileURLToPath(new URL(path, import.meta.url));
const environment = readFileSync(file('../src/environments/environment.ts'), 'utf8');
const value = (key) => environment.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']*)["']`))?.[1] ?? '';

const config = JSON.parse(readFileSync(file('../src-tauri/tauri.conf.json'), 'utf8'));
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
    console.error(`[desktop] ${origin} is missing from ${directive} in src-tauri/tauri.conf.json`);
  }
  process.exit(1);
}

const dist = new URL(`../src-tauri/${config.build.frontendDist}/`, import.meta.url);
copyFileSync(new URL('index.csr.html', dist), new URL('index.html', dist));
console.log('[desktop] CSP OK; index.html = index.csr.html');
