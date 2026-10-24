import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { I18nService } from '../i18n/i18n.service';
import { DesktopTrayService } from './desktop-tray.service';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve()) }));

/** Diccionario de prueba: vacío = todavía no cargó y translate devuelve la clave. */
class FakeI18n {
  readonly dictionary = signal<Record<string, string>>({});
  translate = (key: string) => this.dictionary()[key] ?? key;
}

const SPANISH = {
  'desktopTray.open': 'Abrir RedSana',
  'desktopTray.quit': 'Salir',
  'desktopTray.tooltip': 'RedSana',
  'desktopTray.noticeTitle': 'Sigue midiendo',
  'desktopTray.noticeBody': 'Está en la bandeja',
};

describe('DesktopTrayService', () => {
  let i18n: FakeI18n;

  beforeEach(() => {
    vi.mocked(invoke).mockClear();
    i18n = new FakeI18n();
    TestBed.configureTestingModule({ providers: [{ provide: I18nService, useValue: i18n }] });
    TestBed.inject(DesktopTrayService);
  });

  it('no crea la bandeja con claves crudas mientras el diccionario no llega', () => {
    TestBed.tick();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('crea la bandeja con los textos traducidos y los actualiza al cambiar de idioma', () => {
    i18n.dictionary.set(SPANISH);
    TestBed.tick();
    expect(invoke).toHaveBeenLastCalledWith('install_tray', {
      texts: {
        open: 'Abrir RedSana',
        quit: 'Salir',
        tooltip: 'RedSana',
        noticeTitle: 'Sigue midiendo',
        noticeBody: 'Está en la bandeja',
      },
    });

    i18n.dictionary.set({ ...SPANISH, 'desktopTray.quit': 'Quit' });
    TestBed.tick();
    expect(vi.mocked(invoke).mock.lastCall?.[1]).toMatchObject({ texts: { quit: 'Quit' } });
  });
});
