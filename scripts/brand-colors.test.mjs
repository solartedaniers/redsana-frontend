// Falla si el color del manifest o del <meta theme-color> deja de coincidir con el token de fondo del tema oscuro.
// Lee las mismas rutas que branding/generate_icons.py (branding/brand.json); corre en `npm test` con node --test.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  MANIFEST_COLORS,
  META_THEME_COLOR,
  loadTheme,
  readThemeToken,
  syncFile,
  themePath,
} from './sync-theme-color.mjs';

const theme = loadTheme();
const read = (key) => readFileSync(themePath(theme, key), 'utf8');

test('el manifest usa el token de fondo del tema oscuro', () => {
  const token = readThemeToken(theme);
  const manifest = JSON.parse(read('manifest'));
  assert.deepEqual([manifest.theme_color, manifest.background_color], [token, token]);
});

test('el <meta theme-color> usa el mismo token', () => {
  assert.equal(read('indexHtml').match(META_THEME_COLOR)?.[2], readThemeToken(theme));
});

test('sync-theme-color solo cambia el valor del color y conserva el resto del archivo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'theme-'));
  try {
    const html = join(dir, 'index.html');
    const manifest = join(dir, 'manifest.webmanifest');
    writeFileSync(html, '<head>\r\n  <meta name="theme-color" content="#000000">\r\n</head>\r\n');
    writeFileSync(manifest, '{\n  "theme_color": "#000000",\n  "background_color": "#111111",\n  "name": "x"\n}\n');

    syncFile(html, META_THEME_COLOR, '#123456');
    syncFile(manifest, MANIFEST_COLORS, '#123456');

    assert.equal(readFileSync(html, 'utf8'), '<head>\r\n  <meta name="theme-color" content="#123456">\r\n</head>\r\n');
    assert.equal(
      readFileSync(manifest, 'utf8'),
      '{\n  "theme_color": "#123456",\n  "background_color": "#123456",\n  "name": "x"\n}\n',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sync-theme-color falla si el archivo ya no tiene dónde poner el color', () => {
  const dir = mkdtempSync(join(tmpdir(), 'theme-'));
  try {
    const html = join(dir, 'index.html');
    writeFileSync(html, '<head></head>');

    assert.throws(() => syncFile(html, META_THEME_COLOR, '#07090a'), /theme color not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
