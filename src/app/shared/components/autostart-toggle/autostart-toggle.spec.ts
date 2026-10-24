import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { invoke } from '@tauri-apps/api/core';
import { AutostartToggle } from './autostart-toggle';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

/** Imita a Windows: la entrada de inicio existe o no. */
function fakeWindows(initial: boolean) {
  let registered = initial;
  vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
    if (command === 'autostart_enabled') return registered;
    if (command === 'set_autostart') registered = (args as { enabled: boolean }).enabled;
    return undefined;
  });
  return () => registered;
}

async function render() {
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  const fixture = TestBed.createComponent(AutostartToggle);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, input: fixture.nativeElement.querySelector('input[role=switch]') as HTMLInputElement };
}

async function settle(fixture: Awaited<ReturnType<typeof render>>['fixture']) {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

describe('AutostartToggle', () => {
  beforeEach(() => vi.mocked(invoke).mockReset());

  it('apagado por defecto: sin entrada en Windows aparece apagado y no escribe nada', async () => {
    fakeWindows(false);
    const { input } = await render();

    expect(input.checked).toBe(false);
    expect(invoke).not.toHaveBeenCalledWith('set_autostart', expect.anything());
  });

  it('encenderlo registra el inicio con Windows y apagarlo lo borra', async () => {
    const registered = fakeWindows(false);
    const { fixture, input } = await render();

    input.click();
    await settle(fixture);
    expect(registered()).toBe(true);
    expect(input.checked).toBe(true);

    input.click();
    await settle(fixture);
    expect(registered()).toBe(false);
    expect(input.checked).toBe(false);
  });

  it('si Windows no deja cambiarlo, avisa y muestra el estado real', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'set_autostart') throw new Error('acceso denegado');
      return false;
    });
    const { fixture, input } = await render();

    input.click();
    await settle(fixture);

    expect(input.checked).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('auth.profile.autostart.error');
  });
});
