import { fingerprintFromMac } from './network-fingerprint';

describe('fingerprintFromMac', () => {
  it('produce un SHA-256 hex de 64 caracteres que no contiene la MAC', async () => {
    const fingerprint = await fingerprintFromMac('3c-6a-d2-c8-5a-ec');

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain('3c6ad2');
  });

  it('la misma MAC en otro formato da la misma huella (mismo router = misma red)', async () => {
    expect(await fingerprintFromMac('3C:6A:D2:C8:5A:EC')).toBe(await fingerprintFromMac('3c-6a-d2-c8-5a-ec'));
  });

  it('routers distintos dan huellas distintas', async () => {
    expect(await fingerprintFromMac('3c-6a-d2-c8-5a-ec')).not.toBe(await fingerprintFromMac('18-56-80-3b-2c-11'));
  });
});
