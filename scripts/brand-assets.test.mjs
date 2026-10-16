// Falla si BRAND_ASSETS apunta a una imagen distinta de la que genera branding/generate_icons.py, o si no existe.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANDING_DIR = resolve(ROOT, 'branding');
const PUBLIC_DIR = resolve(ROOT, 'public');
const BRAND_ASSETS_FILE = resolve(ROOT, 'src/app/core/branding/brand-assets.ts');

test('la marca que carga la app es la que genera el script de branding', () => {
  const config = JSON.parse(readFileSync(resolve(BRANDING_DIR, 'brand.json'), 'utf8'));
  const markUrl = readFileSync(BRAND_ASSETS_FILE, 'utf8').match(/mark:\s*'([^']+)'/)?.[1];

  assert.ok(markUrl, 'BRAND_ASSETS.mark not found');
  assert.equal(resolve(PUBLIC_DIR, markUrl), resolve(BRANDING_DIR, config.brandMark.path));
  assert.ok(existsSync(resolve(PUBLIC_DIR, markUrl)), `${markUrl} does not exist`);
});
