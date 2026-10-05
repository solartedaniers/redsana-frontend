import { COMPUTER_OUIS, PHONE_OUIS } from './oui-device-kinds.generated';

export type DeviceKind = 'phone' | 'computer' | 'unknown';

// Bit "localmente administrada" del primer octeto: la MAC es aleatoria/privada
// (lo que hacen por defecto iOS, Android y Windows), así que su prefijo no
// identifica a ningún fabricante.
const LOCALLY_ADMINISTERED_BIT = 0x02;

/** Normaliza a 6 hex chars mayúsculas sin separadores (soporta ':' y '-'). */
function ouiPrefix(macAddress: string): string {
  return macAddress.replace(/[:-]/g, '').toUpperCase().slice(0, 6);
}

function isRandomizedMac(prefix: string): boolean {
  return (parseInt(prefix.slice(0, 2), 16) & LOCALLY_ADMINISTERED_BIT) !== 0;
}

// Infiere el tipo de dispositivo por el fabricante (OUI) de su MAC, según el
// registro de la IEEE (ver scripts/generate-oui-table.mjs). Nunca adivina: MAC
// aleatoria, fabricante que hace de todo o desconocido -> 'unknown'.
export function inferDeviceKind(macAddress: string): DeviceKind {
  const prefix = ouiPrefix(macAddress);
  if (isRandomizedMac(prefix)) {
    return 'unknown';
  }
  if (PHONE_OUIS.has(prefix)) {
    return 'phone';
  }
  if (COMPUTER_OUIS.has(prefix)) {
    return 'computer';
  }
  return 'unknown';
}
