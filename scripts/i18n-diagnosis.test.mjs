// Falla si falta algún texto del diagnóstico router / proveedor o si la pista de dispositivo deja de decir que es
// solo una posibilidad. Corre en `npm test`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const I18N_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets/i18n');
const POSSIBILITY_WORDS = { es: /posiblemente/i, en: /possibly/i };

const diagnosis = (lang) =>
  JSON.parse(readFileSync(resolve(I18N_DIR, `${lang}.json`), 'utf8')).user.dashboard.diagnosis;

for (const [lang, possibility] of Object.entries(POSSIBILITY_WORDS)) {
  test(`${lang}: cada diagnóstico tiene su texto y el de "antes de reiniciar" cuando hay problema`, () => {
    const texts = diagnosis(lang);
    for (const key of ['title', 'routerLatency', 'routerNoReply', 'offlineNote', 'restartLabel', 'possibleBusyDevice'])
      assert.ok(texts[key]?.trim(), key);
    for (const kind of ['router', 'router_unreachable', 'provider', 'ok'])
      assert.ok(texts[kind]?.verdict?.trim(), `${kind}.verdict`);
    for (const kind of ['router', 'router_unreachable', 'provider'])
      assert.ok(texts[kind]?.restart?.trim(), `${kind}.restart`);
    assert.match(texts.routerLatency, /\{\{ms\}\}/);
    assert.match(texts.offlineNote, /\{\{time\}\}/);
  });

  test(`${lang}: la pista de dispositivo saturando se presenta como posible, nunca como hecho`, () => {
    assert.match(diagnosis(lang).possibleBusyDevice, possibility);
  });
}
