import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

const ERROR_KEY = 'auth.profile.autostart.error';

/**
 * Solo escritorio (el perfil lo carga con @defer, la web nunca lo descarga). Lo que muestra es lo que dice Windows
 * (autostart_enabled): si el usuario lo apaga en el Administrador de tareas, aquí aparece apagado.
 */
@Component({
  selector: 'app-autostart-toggle',
  imports: [TranslatePipe],
  templateUrl: './autostart-toggle.html',
  styleUrl: './autostart-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutostartToggle {
  /** null mientras se consulta a Windows. */
  protected readonly enabled = signal<boolean | null>(null);
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  constructor() {
    void this.refresh();
  }

  protected async change(toggle: HTMLInputElement): Promise<void> {
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await invoke('set_autostart', { enabled: toggle.checked });
    } catch (error) {
      console.error('No se pudo cambiar el inicio con Windows', error);
      this.errorKey.set(ERROR_KEY);
    }
    await this.refresh();
    // Si Windows no aceptó el cambio la señal no cambia y Angular no corrige la casilla: la dejo como dice Windows.
    toggle.checked = this.enabled() === true;
    this.busy.set(false);
  }

  private async refresh(): Promise<void> {
    try {
      this.enabled.set(await invoke<boolean>('autostart_enabled'));
    } catch (error) {
      console.error('No se pudo leer el inicio con Windows', error);
      this.enabled.set(false);
      this.errorKey.set(ERROR_KEY);
    }
  }
}
