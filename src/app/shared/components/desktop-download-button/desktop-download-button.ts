import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RuntimeEnvironmentService } from '../../../core/runtime/runtime-environment.service';

// Único lugar que conoce la URL del instalador; dentro de la app de escritorio
// no se muestra porque ya está instalada.
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
