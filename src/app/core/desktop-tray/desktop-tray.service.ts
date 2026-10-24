import { Injectable, effect, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { I18nService } from '../i18n/i18n.service';

const TEXT_KEYS = {
  open: 'desktopTray.open',
  quit: 'desktopTray.quit',
  tooltip: 'desktopTray.tooltip',
  noticeTitle: 'desktopTray.noticeTitle',
  noticeBody: 'desktopTray.noticeBody',
} as const;

export type TrayTexts = Record<keyof typeof TEXT_KEYS, string>;

/**
 * Solo escritorio (se carga aparte, la web nunca baja este código): pasa a Rust los textos de la bandeja y del aviso
 * del primer cierre en el idioma activo, y los vuelve a pasar si el usuario cambia de idioma. Sin bandeja, cerrar la
 * ventana cierra la app como antes.
 */
@Injectable({ providedIn: 'root' })
export class DesktopTrayService {
  private readonly i18n = inject(I18nService);

  private readonly sync = effect(() => {
    const texts = this.texts();
    if (texts) {
      invoke('install_tray', { texts }).catch((error: unknown) => console.error('No se pudo crear la bandeja', error));
    }
  });

  /** null mientras el diccionario no llegue: no se instala una bandeja con claves crudas. */
  private texts(): TrayTexts | null {
    const entries = Object.entries(TEXT_KEYS).map(([name, key]) => [name, this.i18n.translate(key)] as const);
    return entries.some(([name, text]) => text === TEXT_KEYS[name as keyof TrayTexts])
      ? null
      : (Object.fromEntries(entries) as TrayTexts);
  }
}
