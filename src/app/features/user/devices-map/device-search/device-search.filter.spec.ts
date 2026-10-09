import { NetworkDevice } from '../../../../core/models/device.model';
import { DeviceSearchField } from './device-search.config';
import { DeviceSearchFilter } from './device-search.filter';

function device(id: string, ipAddress: string, name = '', macAddress = 'aa-bb-cc-00-00-01'): NetworkDevice {
  return { id, name, macAddress, ipAddress, trust: 'unknown', firstSeen: '', lastSeen: '', isOnline: true, networkRole: 'other' };
}

describe('DeviceSearchFilter', () => {
  const filter = new DeviceSearchFilter();
  const devices = [
    device('a', '192.168.1.15', 'Portátil de Ana', 'AA-BB-CC-11-22-33'),
    device('b', '192.168.1.150', 'Televisor'),
    device('c', '192.168.1.2', ''),
  ];
  const ids = (query: string) => filter.filter(devices, query).map((d) => d.id);

  it('una búsqueda vacía o solo con espacios devuelve todos', () => {
    expect(ids('')).toEqual(['a', 'b', 'c']);
    expect(ids('   ')).toEqual(['a', 'b', 'c']);
  });

  it('encuentra por IP exacta y por IP parcial', () => {
    expect(ids('192.168.1.2')).toEqual(['c']);
    expect(ids('1.15')).toEqual(['a', 'b']);
    expect(ids('15')).toEqual(['a', 'b']);
  });

  it('ignora los espacios al inicio y al final', () => {
    expect(ids('  192.168.1.2  ')).toEqual(['c']);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(ids('10.0.0.9')).toEqual([]);
  });

  it('encuentra por nombre sin distinguir mayúsculas', () => {
    expect(ids('TELEVISOR')).toEqual(['b']);
    expect(ids('portátil')).toEqual(['a']);
  });

  it('encuentra por MAC con cualquier separador o sin él', () => {
    expect(ids('aa:bb:cc:11')).toEqual(['a']);
    expect(ids('ccdd')).toEqual([]);
    expect(ids('112233')).toEqual(['a']);
  });

  it('busca en los campos que diga la configuración, también uno como el fabricante', () => {
    const withVendor: DeviceSearchField[] = [{ key: 'vendor', read: (d) => (d.id === 'b' ? 'Samsung' : null), normalization: 'text' }];
    expect(new DeviceSearchFilter(withVendor).filter(devices, 'samsung').map((d) => d.id)).toEqual(['b']);
  });
});
