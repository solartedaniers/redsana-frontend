// Genera public/robots.txt y public/sitemap.xml en cada build. El dominio sale de WEB_APP_URL y las
// rutas de src/app/core/routing/app-paths.ts, así que ninguno de los dos archivos vive en el repo.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
const APP_PATHS_FILE = fileURLToPath(new URL('../src/app/core/routing/app-paths.ts', import.meta.url));
const ROBOTS_FILE = fileURLToPath(new URL('../public/robots.txt', import.meta.url));
const SITEMAP_FILE = fileURLToPath(new URL('../public/sitemap.xml', import.meta.url));

// Detrás del login: no hay nada que rastrear. /auth queda rastreable a propósito: login y registro llevan
// <meta name="robots" content="noindex"> (DocumentMetadataService) y un buscador solo lo ve si puede entrar.
export const PRIVATE_SEGMENT_KEYS = ['user', 'admin', 'account'];

/** Lee ROUTE_SEGMENTS de app-paths.ts: un renombre de ruta llega aquí sin tocar este script. */
export function readRouteSegments(source = readFileSync(APP_PATHS_FILE, 'utf8')) {
  const block = source.match(/ROUTE_SEGMENTS = \{([\s\S]*?)\}/)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(\w+):\s*'([^']+)'/g)].map(([, key, value]) => [key, value]));
}

export function buildRobots(siteUrl, segments) {
  const disallowed = PRIVATE_SEGMENT_KEYS.map((key) => {
    if (!segments[key]) {
      throw new Error(`ROUTE_SEGMENTS.${key} no existe en app-paths.ts`);
    }
    return `Disallow: /${segments[key]}/`;
  });
  return ['User-agent: *', 'Allow: /', ...disallowed, '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

/** Solo la landing: es la única página pública con contenido propio. */
export function buildSitemap(siteUrl) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${siteUrl}/</loc></url>`,
    '</urlset>',
    '',
  ].join('\n');
}

function main() {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  const siteUrl = (process.env.WEB_APP_URL || '').replace(/\/+$/, '');
  if (!siteUrl) {
    // Mismo criterio que generate-environment.mjs para el flujo local sin variables; en Vercel siempre está.
    console.log('[seo] WEB_APP_URL not set, skipping robots.txt and sitemap.xml');
    return;
  }
  writeFileSync(ROBOTS_FILE, buildRobots(siteUrl, readRouteSegments()));
  writeFileSync(SITEMAP_FILE, buildSitemap(siteUrl));
  console.log(`[seo] robots.txt and sitemap.xml generated for ${siteUrl}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
