// Falla si alguna recomendación de seguridad no trae su texto de "cómo hacerlo" en algún idioma. Corre en `npm test`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const I18N_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets/i18n');
const LANGUAGES = ['es', 'en'];

const assistant = (lang) => JSON.parse(readFileSync(resolve(I18N_DIR, `${lang}.json`), 'utf8')).user.securityAssistant;

for (const lang of LANGUAGES) {
  test(`${lang}: cada recomendación tiene su "cómo hacerlo"`, () => {
    const recommendations = Object.entries(assistant(lang).recommendations);
    assert.ok(recommendations.length > 0);
    for (const [id, texts] of recommendations) {
      assert.equal(typeof texts.how, 'string', `${id} no tiene how`);
      assert.ok(texts.how.trim().length > 0, `${id}: how vacío`);
    }
    assert.ok(assistant(lang).howLabel?.trim(), 'falta howLabel');
  });
}

test('los dos idiomas tienen las mismas recomendaciones', () => {
  assert.deepEqual(
    Object.keys(assistant('es').recommendations).sort(),
    Object.keys(assistant('en').recommendations).sort(),
  );
});
