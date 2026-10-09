import { NetworkDevice } from '../../../../core/models/device.model';

/** 'text': minúsculas y sin espacios en los bordes. 'mac': además ignora los separadores ':' y '-'. */
export type DeviceSearchNormalization = 'text' | 'mac';

export interface DeviceSearchField {
  readonly key: string;
  readonly read: (device: NetworkDevice) => string | null | undefined;
  readonly normalization: DeviceSearchNormalization;
}

// La IP va primero porque es el criterio principal; el fabricante no está aquí porque el
// modelo no lo tiene (solo existe el tipo deducido del OUI).
export const DEVICE_SEARCH_FIELDS: readonly DeviceSearchField[] = [
  { key: 'ip', read: (device) => device.ipAddress, normalization: 'text' },
  { key: 'name', read: (device) => device.name, normalization: 'text' },
  { key: 'mac', read: (device) => device.macAddress, normalization: 'mac' },
];

/** Separadores que ignoro al comparar MAC, para que "aa:bb" encuentre "AA-BB-…". */
export const MAC_SEPARATORS = /[:-]/g;
