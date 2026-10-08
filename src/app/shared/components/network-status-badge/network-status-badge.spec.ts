import { TestBed } from '@angular/core/testing';
import { NetworkStatus } from '../../../core/models/network.model';
import { NetworkStatusBadge } from './network-status-badge';

function render(status: NetworkStatus | null): HTMLElement {
  const fixture = TestBed.createComponent(NetworkStatusBadge);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('NetworkStatusBadge', () => {
  it('muestra el estado real de la medición, no uno fijo', () => {
    const badge = render('critical').querySelector('.status-badge');

    expect(badge?.textContent?.trim()).toBe('common.networkStatus.critical');
    expect(badge?.getAttribute('data-status')).toBe('critical');
  });

  for (const status of [null, 'unknown'] as const) {
    it(`sin medición (${status}) no muestra nada`, () => {
      expect(render(status).querySelector('.status-badge')).toBeNull();
    });
  }
});
