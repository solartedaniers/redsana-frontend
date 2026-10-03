import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RuntimeEnvironmentService } from '../../core/runtime/runtime-environment.service';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslatePipe, Icon],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  protected readonly isDesktop = inject(RuntimeEnvironmentService).isDesktop;
  protected readonly desktopDownloadUrl = environment.desktopDownloadUrl;
}
