// Falla si el frontend vuelve a usar un nombre de ruta anterior del backend: esos siguen vivos solo como alias para el
// instalador 0.1.5 y la web ya desplegada (ver README del backend). Corre en `npm test` con node --test.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const LEGACY_ROUTES = [
  /\/api\/me\b/,
  /\/api\/conversations\b/,
  /\/api\/admin\/metrics\b/,
  /\/api\/alerts\/new\b/,
  /baseUrl\}\/new\b/,
];

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* sourceFiles(path);
    } else if (/\.(ts|html)$/.test(entry.name)) {
      yield path;
    }
  }
}

test('el frontend solo usa los nombres de ruta nuevos', () => {
  const hits = [];
  for (const file of sourceFiles(SRC_DIR)) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of LEGACY_ROUTES) {
      if (pattern.test(text)) {
        hits.push(`${file}: ${pattern}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
