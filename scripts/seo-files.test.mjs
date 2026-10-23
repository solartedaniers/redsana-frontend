// robots.txt y sitemap.xml: el dominio llega de afuera, la landing es lo único indexable y toda ruta de primer nivel
// detrás del login queda fuera del rastreo. Corre en `npm test` con node --test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PRIVATE_SEGMENT_KEYS, buildRobots, buildSitemap, readRouteSegments } from './generate-seo-files.mjs';

const SITE = 'https://ejemplo.invalid';
const APP_ROUTES = readFileSync(fileURLToPath(new URL('../src/app/app.routes.ts', import.meta.url)), 'utf8');

test('robots.txt deja la landing, saca las rutas privadas y apunta al sitemap del dominio dado', () => {
  const robots = buildRobots(SITE, readRouteSegments());

  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  for (const segment of ['user', 'admin', 'account']) {
    assert.match(robots, new RegExp(`^Disallow: /${segment}/$`, 'm'));
  }
  assert.doesNotMatch(robots, /^Disallow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${SITE}/sitemap.xml$`, 'm'));
});

test('cada ruta de primer nivel con guarda de sesión está en la lista privada', () => {
  // Bloques de primer nivel de app.routes.ts que llevan authGuard: su primer segmento debe ser privado.
  const guarded = [...APP_ROUTES.matchAll(/path: `?\$?\{?ROUTE_SEGMENTS\.(\w+)[^\n]*\n(?:(?!\n  \{)[\s\S])*?authGuard/g)].map(
    ([, key]) => key
  );

  assert.ok(guarded.length >= 3, `rutas con guarda encontradas: ${guarded}`);
  assert.deepEqual([...new Set(guarded)].sort(), [...PRIVATE_SEGMENT_KEYS].sort());
});

test('un segmento que ya no existe rompe el build en vez de dejar un robots.txt incompleto', () => {
  assert.throws(() => buildRobots(SITE, { user: 'user' }), /ROUTE_SEGMENTS\.admin/);
});

test('el sitemap solo lista la landing del dominio dado', () => {
  const sitemap = buildSitemap(SITE);

  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc), [`${SITE}/`]);
  assert.match(sitemap, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
});

test('el service worker deja pasar la navegación: quien vuelve a / recibe la landing prerenderizada', () => {
  // Con "performance" (el valor por defecto) el SW respondía toda navegación con index.csr.html desde su caché.
  const config = JSON.parse(readFileSync(fileURLToPath(new URL('../ngsw-config.json', import.meta.url)), 'utf8'));

  assert.equal(config.navigationRequestStrategy, 'freshness');
  assert.equal(config.index, '/index.csr.html');
});
