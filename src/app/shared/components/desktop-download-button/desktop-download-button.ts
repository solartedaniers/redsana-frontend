import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DESKTOP_RELEASE_CONFIG } from '../../../core/desktop-release/desktop-release.config';
import { DesktopInstallerLink, DesktopReleaseResolver } from '../../../core/desktop-release/desktop-release.resolver';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RuntimeEnvironmentService } from '../../../core/runtime/runtime-environment.service';

/**
 * The only download entry point (landing and the user's download screen).
 * On click it asks DesktopReleaseResolver for the installer of the latest
 * release and navigates to it so the browser downloads the .exe; if that
 * fails it opens the release page and says so. Hidden inside the desktop app.
 * The href keeps the release page so the link still works without scripts.
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
      // A release asset is served as an attachment: the browser downloads it and stays on this page.
      this.window?.location.assign(link.url);
      return;
    }
    this.noticeKey.set('landing.downloadFallback');
    const tab = this.window?.open(link.url, '_blank');
    if (tab) {
      tab.opener = null;
    } else {
      // Popup blocked: open the release page here instead.
      this.window?.location.assign(link.url);
    }
  }
}
