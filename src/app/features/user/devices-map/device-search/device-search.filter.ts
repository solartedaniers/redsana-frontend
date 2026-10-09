import { NetworkDevice } from '../../../../core/models/device.model';
import { DEVICE_SEARCH_FIELDS, DeviceSearchField, DeviceSearchNormalization, MAC_SEPARATORS } from './device-search.config';

/**
 * Filtra dispositivos por coincidencia parcial en los campos configurados. Es puro: no guarda
 * la búsqueda ni llama al backend, solo decide qué dispositivos ya cargados coinciden.
 */
export class DeviceSearchFilter {
  constructor(private readonly fields: readonly DeviceSearchField[] = DEVICE_SEARCH_FIELDS) {}

  /** true si no queda nada que buscar tras recortar espacios. */
  isEmpty(query: string): boolean {
    return query.trim().length === 0;
  }

  filter(devices: readonly NetworkDevice[], query: string): NetworkDevice[] {
    if (this.isEmpty(query)) {
      return [...devices];
    }
    return devices.filter((device) => this.matches(device, query));
  }

  matches(device: NetworkDevice, query: string): boolean {
    return this.fields.some((field) => {
      const value = field.read(device);
      const needle = this.normalize(query, field.normalization);
      return !!value && needle.length > 0 && this.normalize(value, field.normalization).includes(needle);
    });
  }

  private normalize(value: string, normalization: DeviceSearchNormalization): string {
    const text = value.trim().toLocaleLowerCase();
    return normalization === 'mac' ? text.replace(MAC_SEPARATORS, '') : text;
  }
}
