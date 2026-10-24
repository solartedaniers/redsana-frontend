// Copia el token de fondo del tema oscuro (branding/brand.json → theme) al <meta theme-color> de index.html y a los
// colores del manifest en cada build: el color vive solo en _tokens.scss. Solo reemplaza el valor, no reformatea.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BRANDING_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../branding');

export const META_THEME_COLOR = /(<meta name="theme-color" content=")([^"]*)(")/;
export const MANIFEST_COLORS = /("(?:theme_color|background_color)":\s*")([^"]*)(")/g;

export function loadTheme() {
  return JSON.parse(readFileSync(resolve(BRANDING_DIR, 'brand.json'), 'utf8')).theme;
}

export function themePath(theme, key) {
  return resolve(BRANDING_DIR, theme[key]);
}

/** El valor del token dentro del bloque del selector del tema oscuro. */
export function readThemeToken(theme) {
  const block = readFileSync(themePath(theme, 'tokensFile'), 'utf8').split(theme.selector)[1]?.split('}')[0] ?? '';
  const escaped = theme.token.replace(/[-]/g, '\\-');
  const match = block.match(new RegExp(`${escaped}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`token ${theme.token} not found under ${theme.selector}`);
  }
  return match[1].trim();
}

export function syncFile(path, pattern, color) {
  const source = readFileSync(path, 'utf8');
  if (!source.match(pattern)) {
    throw new Error(`theme color not found in ${path}`);
  }
  const synced = source.replace(pattern, (_, before, _old, after) => `${before}${color}${after}`);
  if (synced !== source) {
    writeFileSync(path, synced);
  }
}

function main() {
  const theme = loadTheme();
  const color = readThemeToken(theme);
  syncFile(themePath(theme, 'indexHtml'), META_THEME_COLOR, color);
  syncFile(themePath(theme, 'manifest'), MANIFEST_COLORS, color);
  console.log(`[theme] theme-color ${color}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
