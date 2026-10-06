import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DesktopDownloadButton } from '../../../shared/components/desktop-download-button/desktop-download-button';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-desktop-download',
  imports: [TranslatePipe, DesktopDownloadButton, Icon, PageHeader],
  templateUrl: './desktop-download.html',
  styleUrl: './desktop-download.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopDownload {}
