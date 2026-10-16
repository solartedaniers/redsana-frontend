// Falla si el color del manifest o del <meta theme-color> deja de coincidir con el token de fondo del tema oscuro.
// Lee las mismas rutas que branding/generate_icons.py (branding/brand.json); corre en `npm test` con node --test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const BRANDING_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../branding');

class BrandThemeSources {
  constructor(theme) {
    this.theme = theme;
  }

  static load() {
    const config = JSON.parse(readFileSync(resolve(BRANDING_DIR, 'brand.json'), 'utf8'));
    return new BrandThemeSources(config.theme);
  }

  read(key) {
    return readFileSync(resolve(BRANDING_DIR, this.theme[key]), 'utf8');
  }

  tokenValue() {
    const block = this.read('tokensFile').split(this.theme.selector)[1]?.split('}')[0] ?? '';
    const escaped = this.theme.token.replace(/[-]/g, '\\-');
    const match = block.match(new RegExp(`${escaped}:\\s*([^;]+);`));
    assert.ok(match, `token ${this.theme.token} not found under ${this.theme.selector}`);
    return match[1].trim();
  }

  manifestColors() {
    const manifest = JSON.parse(this.read('manifest'));
    return [manifest.theme_color, manifest.background_color];
  }

  metaThemeColor() {
    return this.read('indexHtml').match(/<meta name="theme-color" content="([^"]*)"/)?.[1];
  }
}

const sources = BrandThemeSources.load();

test('el manifest usa el token de fondo del tema oscuro', () => {
  const token = sources.tokenValue();
  assert.deepEqual(sources.manifestColors(), [token, token]);
});

test('el <meta theme-color> usa el mismo token', () => {
  assert.equal(sources.metaThemeColor(), sources.tokenValue());
});
