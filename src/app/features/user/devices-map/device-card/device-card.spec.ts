import { TestBed } from '@angular/core/testing';
import { DeviceTrust, NetworkDevice } from '../../../../core/models/device.model';
import { DeviceCard } from './device-card';

const ROUTER: NetworkDevice = {
  id: 'r1', name: '', macAddress: '3c-6a-d2-c8-5a-ec', ipAddress: '192.168.0.1', trust: 'unknown',
  firstSeen: '2026-10-01T00:00:00Z', lastSeen: '2026-10-01T00:00:00Z', isOnline: true, networkRole: 'gateway',
};

function render(device: NetworkDevice) {
  const fixture = TestBed.createComponent(DeviceCard);
  fixture.componentRef.setInput('device', device);
  const emitted: DeviceTrust[] = [];
  fixture.componentInstance.trustChange.subscribe((trust) => emitted.push(trust));
  fixture.detectChanges();
  return { fixture, emitted, element: fixture.nativeElement as HTMLElement };
}

const button = (element: HTMLElement, key: string) =>
  [...element.querySelectorAll<HTMLButtonElement>('.device-actions button')].find((b) => b.textContent?.trim() === key);

describe('DeviceCard', () => {
  it('muestra el papel del router en su propia línea y pide los cambios de confianza al padre', () => {
    const { element, emitted } = render(ROUTER);

    expect(element.querySelector('.device-info > .device-role')?.textContent?.trim()).toBe('user.devicesMap.role.gateway');
    button(element, 'user.devicesMap.block')!.click();
    button(element, 'user.devicesMap.markTrusted')!.click();

    expect(emitted).toEqual(['blocked', 'trusted']);
    expect(button(element, 'user.devicesMap.clearTrust')).toBeUndefined(); // "unknown" no tiene marca que quitar
  });

  it('"Más info" muestra la MAC solo en esta tarjeta', () => {
    const { fixture, element } = render(ROUTER);
    expect(element.querySelector('.device-detail-table')).toBeNull();

    button(element, 'user.devicesMap.moreInfo')!.click();
    fixture.detectChanges();

    expect(element.querySelector('.device-detail-table td')?.textContent?.trim()).toBe(ROUTER.macAddress);
  });
});
