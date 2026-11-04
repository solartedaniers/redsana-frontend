import { TestBed } from '@angular/core/testing';
import { LiveUpdates } from '../../../core/realtime/live-updates';
import { LiveUpdatesIndicator } from './live-updates-indicator';

describe('LiveUpdatesIndicator', () => {
  it('dice "Actualizando" mientras sondea y "En vivo" con el socket abierto', () => {
    const fixture = TestBed.createComponent(LiveUpdatesIndicator);
    fixture.detectChanges();
    const label = () => (fixture.nativeElement as HTMLElement).textContent?.trim();
    expect(label()).toBe('common.liveUpdates.polling');

    TestBed.inject(LiveUpdates).setLive(true);
    fixture.detectChanges();

    expect(label()).toBe('common.liveUpdates.live');
  });
});
