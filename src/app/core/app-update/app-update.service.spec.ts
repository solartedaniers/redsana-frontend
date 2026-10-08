import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

function setup(isEnabled: boolean) {
  const versionUpdates = new Subject<VersionEvent>();
  TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: { isEnabled, versionUpdates } }] });
  return { service: TestBed.inject(AppUpdateService), versionUpdates };
}

describe('AppUpdateService', () => {
  it('avisa solo cuando la versión nueva ya está lista, no mientras se detecta o descarga', () => {
    const { service, versionUpdates } = setup(true);

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
    expect(service.isUpdateReady()).toBe(false);

    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'old' }, latestVersion: { hash: 'new' } });
    expect(service.isUpdateReady()).toBe(true);
  });

  it('sin Service Worker (escritorio o desarrollo) nunca avisa', () => {
    const { service, versionUpdates } = setup(false);

    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'old' }, latestVersion: { hash: 'new' } });

    expect(service.isUpdateReady()).toBe(false);
  });
});
