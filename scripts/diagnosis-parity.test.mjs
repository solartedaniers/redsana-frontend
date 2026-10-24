// La tabla de paridad del diagnóstico es la misma en el backend (tests/fixtures/network_diagnosis_cases.json), que
// exige esta misma huella: si alguien cambia una copia y no la otra, falla uno de los dos repositorios. Corre en `npm test`.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PARITY_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/app/core/domain/network-diagnosis-cases.json',
);
const PARITY_SHA256 = '5766dc764583233a63b2e50f5d8932313cd40299dac2ea07eb1e5992677fe584';

test('la tabla de paridad del diagnóstico es la acordada con el backend', () => {
  // Sin \r: git puede dejar el archivo con CRLF en Windows.
  const bytes = Buffer.from(readFileSync(PARITY_FILE, 'latin1').replaceAll('\r', ''), 'latin1');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), PARITY_SHA256);
});
