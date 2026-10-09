import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DESKTOP_RELEASE_CONFIG } from '../../../core/desktop-release/desktop-release.config';
import { DesktopInstallerLink, DesktopReleaseResolver } from '../../../core/desktop-release/desktop-release.resolver';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RuntimeEnvironmentService } from '../../../core/runtime/runtime-environment.service';

/**
 * Único punto de descarga: pide el instalador del último release y navega a él; si falla, abre la
 * página del release y lo avisa. El href conserva esa página para que funcione sin scripts.
 */
@Component({
  selector: 'app-desktop-download-button',
  imports: [TranslatePipe],
  templateUrl: './desktop-download-button.html',
  styleUrl: './desktop-download-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopDownloadButton {
  private readonly resolver = inject(DesktopReleaseResolver);
  private readonly window = inject(DOCUMENT).defaultView;

  protected readonly isDesktop = inject(RuntimeEnvironmentService).isDesktop;
  protected readonly fallbackUrl = inject(DESKTOP_RELEASE_CONFIG).fallbackUrl;
  protected readonly isResolving = signal(false);
  protected readonly noticeKey = signal<string | null>(null);

  protected download(event: MouseEvent): void {
    event.preventDefault();
    if (this.isResolving()) {
      return;
    }
    this.isResolving.set(true);
    this.noticeKey.set(null);
    this.resolver.resolve().subscribe((link) => {
      this.isResolving.set(false);
      this.open(link);
    });
  }

  private open(link: DesktopInstallerLink): void {
    if (link.kind === 'installer') {
      // GitHub sirve el asset como adjunto: el navegador lo descarga y se queda en esta página.
      this.window?.location.assign(link.url);
      return;
    }
    this.noticeKey.set('landing.downloadFallback');
    const tab = this.window?.open(link.url, '_blank');
    if (tab) {
      tab.opener = null;
    } else {
      // Si el navegador bloqueó la ventana, abro la página del release aquí mismo.
      this.window?.location.assign(link.url);
    }
  }
}
