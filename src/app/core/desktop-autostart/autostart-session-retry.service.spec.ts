import { TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService, SessionRestoreState } from '../auth/auth.service';
import { SESSION_RESTORE_CONFIG } from '../auth/session-restore.config';
import { AutostartSessionRetry } from './autostart-session-retry.service';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

function setup(launchedByWindows: boolean) {
  vi.mocked(invoke).mockResolvedValue(launchedByWindows);
  const restoreState = signal<SessionRestoreState>('pending');
  const auth = { restoreState, retryRestore: vi.fn(() => restoreState.set('pending')) };
  TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
  TestBed.inject(AutostartSessionRetry);
  return { auth, restoreState };
}

/** La restauración vence (sin red) y paso la pausa entre intentos. */
async function failAndWait(restoreState: WritableSignal<SessionRestoreState>) {
  await vi.advanceTimersByTimeAsync(0);
  restoreState.set('failed');
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(SESSION_RESTORE_CONFIG.retryDelayMs);
}

describe('AutostartSessionRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('abierta por Windows: si la sesión falla (sin red) reintenta sola, una y otra vez', async () => {
    const { auth, restoreState } = setup(true);

    await failAndWait(restoreState);
    TestBed.tick();
    await failAndWait(restoreState);

    expect(auth.retryRestore).toHaveBeenCalledTimes(2);
  });

  it('abierta a mano: deja la pantalla de fallo con "Reintentar", como siempre', async () => {
    const { auth, restoreState } = setup(false);

    await failAndWait(restoreState);

    expect(auth.retryRestore).not.toHaveBeenCalled();
  });
});
