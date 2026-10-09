import { inferDeviceKind } from './device-kind';

describe('inferDeviceKind', () => {
  it('reconoce un celular por el fabricante, sin importar separador ni mayúsculas', () => {
    // 00-CA-E0: Guangdong Oppo Mobile
    expect(inferDeviceKind('00-ca-e0-11-22-33')).toBe('phone');
    expect(inferDeviceKind('00:CA:E0:11:22:33')).toBe('phone');
  });

  it('reconoce computadores por fabricante de laptops o de su tarjeta WiFi', () => {
    expect(inferDeviceKind('08-97-98-f4-2a-d3')).toBe('computer'); // Compal (portátiles)
    expect(inferDeviceKind('8c-c6-81-00-00-01')).toBe('computer'); // Intel
    expect(inferDeviceKind('50-bb-b5-00-06-8a')).toBe('computer'); // AzureWave
  });

  it('una MAC aleatoria/privada nunca se clasifica, aunque el prefijo parezca conocido', () => {
    expect(inferDeviceKind('d2-b5-b1-c8-58-ac')).toBe('unknown');
    expect(inferDeviceKind('02-ca-e0-11-22-33')).toBe('unknown'); // 00-CA-E0 (Oppo) con el bit local activo
  });

  it('nunca inventa el tipo: impresoras, cámaras, routers y fabricantes mixtos quedan como unknown', () => {
    expect(inferDeviceKind('64-c6-d2-00-00-01')).toBe('unknown'); // Epson
    expect(inferDeviceKind('a4-14-37-ff-5f-dc')).toBe('unknown'); // Hikvision
    expect(inferDeviceKind('3c-6a-d2-c8-5a-ec')).toBe('unknown'); // TP-Link
    expect(inferDeviceKind('ac-e2-d3-00-00-01')).toBe('unknown'); // HP (también impresoras)
  });
});
