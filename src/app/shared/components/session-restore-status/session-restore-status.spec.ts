import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService, SessionRestoreState } from '../../../core/auth/auth.service';
import { SessionRestoreStatus } from './session-restore-status';

function render(isWaiting: boolean, state: SessionRestoreState) {
  const auth = { isWaitingForSession: signal(isWaiting), restoreState: signal(state), retryRestore: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
  const fixture = TestBed.createComponent(SessionRestoreStatus);
  fixture.detectChanges();
  return { element: fixture.nativeElement as HTMLElement, auth };
}

describe('SessionRestoreStatus', () => {
  it('si ninguna pantalla espera la sesión no muestra nada', () => {
    const { element } = render(false, 'pending');

    expect(element.querySelector('.startup-screen')).toBeNull();
  });

  it('mientras el backend despierta muestra la marca y el aviso, sin error', () => {
    const { element } = render(true, 'pending');

    expect(element.querySelector('.startup-screen__symbol')).not.toBeNull();
    expect(element.querySelector('.session-status__title')?.textContent?.trim()).toBe('common.sessionRestore.wakingTitle');
    expect(element.querySelector('button')).toBeNull();
  });

  it('si vence la espera explica el fallo y reintentar vuelve a pedir el perfil', () => {
    const { element, auth } = render(true, 'failed');

    expect(element.querySelector('.session-status__title')?.textContent?.trim()).toBe('common.sessionRestore.failedTitle');
    element.querySelector<HTMLButtonElement>('button')!.click();

    expect(auth.retryRestore).toHaveBeenCalledOnce();
  });
});
