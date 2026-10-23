// Falla si la leyenda del gráfico o su ayuda llevan números fijos: los umbrales solo llegan por interpolación desde
// NetworkThresholdsService (backend o respaldo). Corre en `npm test` con node --test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const I18N_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets/i18n');
const LANGUAGES = ['es', 'en'];
const SEVERITIES = ['healthy', 'warning', 'critical', 'cut'];
const PLACEHOLDER = /\{\{\w+\}\}/g;

const latencyChart = (lang) => JSON.parse(readFileSync(resolve(I18N_DIR, `${lang}.json`), 'utf8')).common.latencyChart;

for (const lang of LANGUAGES) {
  test(`${lang}: la leyenda son frases simples, sin números ni parámetros`, () => {
    for (const severity of SEVERITIES) {
      const text = latencyChart(lang).legend[severity];
      assert.doesNotMatch(text, /[0-9<>≥≤{]/, `${severity}: ${text}`);
    }
  });

  test(`${lang}: la ayuda de la leyenda no fija umbrales, solo los interpola`, () => {
    for (const severity of SEVERITIES) {
      const text = latencyChart(lang).legendHint[severity];
      assert.doesNotMatch(text.replace(PLACEHOLDER, ''), /[0-9]/, `${severity}: ${text}`);
    }
  });
}
