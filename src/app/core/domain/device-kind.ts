import { COMPUTER_OUIS, PHONE_OUIS } from './oui-device-kinds.generated';

export type DeviceKind = 'phone' | 'computer' | 'unknown';

// Con el bit de "administrada localmente" la MAC es aleatoria (iOS, Android, Windows) y su prefijo no dice el fabricante.
const LOCALLY_ADMINISTERED_BIT = 0x02;

/** Normaliza a 6 caracteres hex en mayúsculas, sin ':' ni '-'. */
function ouiPrefix(macAddress: string): string {
  return macAddress.replace(/[:-]/g, '').toUpperCase().slice(0, 6);
}

function isRandomizedMac(prefix: string): boolean {
  return (parseInt(prefix.slice(0, 2), 16) & LOCALLY_ADMINISTERED_BIT) !== 0;
}

// Deduzco el tipo por el fabricante (OUI) de la MAC; si hay duda devuelvo 'unknown' en vez de adivinar.
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
