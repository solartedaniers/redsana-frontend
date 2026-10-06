import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DesktopDownloadButton } from '../../shared/components/desktop-download-button/desktop-download-button';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslatePipe, Icon, DesktopDownloadButton],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {}
