import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RuntimeEnvironmentService } from '../../../core/runtime/runtime-environment.service';

// Enlace directo al instalador con nombre fijo del último release: descarga desde el HTML prerenderizado, sin esperar
// a Angular ni a la API de GitHub. Con la hidratación, un clic antes de arrancar no lo podría cancelar ningún script.
@Component({
  selector: 'app-desktop-download-button',
  imports: [TranslatePipe],
  templateUrl: './desktop-download-button.html',
  styleUrl: './desktop-download-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopDownloadButton {
  protected readonly isDesktop = inject(RuntimeEnvironmentService).isDesktop;
  protected readonly downloadUrl = environment.desktopDownloadUrl;
}
