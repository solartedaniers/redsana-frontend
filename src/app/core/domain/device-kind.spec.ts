import { inferDeviceKind } from './device-kind';

describe('inferDeviceKind', () => {
  it('reconoce un prefijo OUI de celular sin importar el separador ni la capitalización', () => {
    expect(inferDeviceKind('3c-5a-b4-11-22-33')).toBe('phone');
    expect(inferDeviceKind('3C:5A:B4:11:22:33')).toBe('phone');
  });

  it('reconoce un prefijo OUI de computador', () => {
    expect(inferDeviceKind('00-1a-11-aa-bb-cc')).toBe('computer');
  });

  it('nunca inventa el tipo: prefijo desconocido devuelve unknown', () => {
    expect(inferDeviceKind('ff-ee-dd-cc-bb-aa')).toBe('unknown');
  });
});
