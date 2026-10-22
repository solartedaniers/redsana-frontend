// Falla si BRAND_ASSETS apunta a una imagen distinta de la que genera branding/generate_icons.py, si no existe
// o si la marca deja de ser transparente (volvería a verse un cuadrado detrás del símbolo).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANDING_DIR = resolve(ROOT, 'branding');
const PUBLIC_DIR = resolve(ROOT, 'public');
const BRAND_ASSETS_FILE = resolve(ROOT, 'src/app/core/branding/brand-assets.ts');
// Cabecera PNG: el tipo de color del bloque IHDR está en el byte 25; 6 es RGBA (con canal alfa).
const PNG_COLOR_TYPE_OFFSET = 25;
const PNG_COLOR_TYPE_RGBA = 6;

const config = JSON.parse(readFileSync(resolve(BRANDING_DIR, 'brand.json'), 'utf8'));
const symbolMaskUrl = readFileSync(BRAND_ASSETS_FILE, 'utf8').match(/symbolMask:\s*'([^']+)'/)?.[1];

test('la marca que carga la app es la que genera el script de branding', () => {
  assert.ok(symbolMaskUrl, 'BRAND_ASSETS.symbolMask not found');
  assert.equal(resolve(PUBLIC_DIR, symbolMaskUrl), resolve(BRANDING_DIR, config.brandMark.path));
  assert.ok(existsSync(resolve(PUBLIC_DIR, symbolMaskUrl)), `${symbolMaskUrl} does not exist`);
});

test('el splash de index.html usa la misma marca que la app', () => {
  const indexHtml = readFileSync(resolve(ROOT, 'src/index.html'), 'utf8');
  assert.ok(indexHtml.includes(`--brand-symbol-mask: url(${symbolMaskUrl})`), 'index.html splash mask is out of date');
});

test('la marca es un PNG con transparencia', () => {
  const png = readFileSync(resolve(PUBLIC_DIR, symbolMaskUrl));
  assert.equal(png[PNG_COLOR_TYPE_OFFSET], PNG_COLOR_TYPE_RGBA);
});
