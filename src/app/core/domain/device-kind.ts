export type DeviceKind = 'phone' | 'computer' | 'unknown';

// OUI (primeros 3 octetos de la MAC) de fabricantes conocidos de celulares y
// computadores. Lista curada y necesariamente incompleta: si el prefijo no
// está, se devuelve 'unknown' en vez de inventar el tipo.
// ponytail: cobertura parcial de vendors, ampliar la tabla si aparecen falsos 'unknown' frecuentes.
const PHONE_OUI_PREFIXES = new Set([
  '3C5AB4', // Apple (iPhone)
  '40331D', // Apple
  'F0DBF8', // Apple
  '3C0754', // Apple
  '8863DF', // Samsung
  '5C0A5B', // Samsung
  '3C5A37', // Samsung
  '040CCE', // Samsung
  'E8508B', // Xiaomi
  '286C07', // Xiaomi
  'F8A45F', // OnePlus
]);

const COMPUTER_OUI_PREFIXES = new Set([
  '001A11', // Dell
  '18034F', // Dell
  'D4BED9', // Dell
  '3417EB', // Intel (laptops)
  'B4B676', // Intel
  '001517', // HP
  '3C520E', // HP
  '00219B', // Lenovo
  'ECF4BB', // Lenovo
]);

/** Normaliza a 6 hex chars mayúsculas sin separadores (soporta ':' y '-'). */
function ouiPrefix(macAddress: string): string {
  return macAddress.replace(/[:-]/g, '').toUpperCase().slice(0, 6);
}

// Infiere el tipo de dispositivo por el fabricante (OUI) de su MAC. Nunca
// adivina: si el prefijo no está en la tabla, es 'unknown'.
export function inferDeviceKind(macAddress: string): DeviceKind {
  const prefix = ouiPrefix(macAddress);
  if (PHONE_OUI_PREFIXES.has(prefix)) {
    return 'phone';
  }
  if (COMPUTER_OUI_PREFIXES.has(prefix)) {
    return 'computer';
  }
  return 'unknown';
}
