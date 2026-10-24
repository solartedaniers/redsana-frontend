// Falla si los textos del puntaje fijan los pesos del cuestionario o del análisis técnico: solo llegan por
// interpolación desde SecurityScoreConfigService (backend o respaldo). Corre en `npm test` con node --test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const I18N_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets/i18n');
const LANGUAGES = ['es', 'en'];
const WEIGHTED_KEYS = ['partialNotice', 'questionnaire', 'technical'];
const PLACEHOLDER = /\{\{\w+\}\}/g;

const scoreTexts = (lang) =>
  JSON.parse(readFileSync(resolve(I18N_DIR, `${lang}.json`), 'utf8')).user.securityAssistant.score;

for (const lang of LANGUAGES) {
  test(`${lang}: los pesos del puntaje se interpolan, no van fijos en el texto`, () => {
    for (const key of WEIGHTED_KEYS) {
      const text = scoreTexts(lang)[key];
      assert.match(text, /\{\{weight\}\}/, `${key}: ${text}`);
      assert.doesNotMatch(text.replace(PLACEHOLDER, '').replace('/100', ''), /[0-9]/, `${key}: ${text}`);
    }
  });
}
