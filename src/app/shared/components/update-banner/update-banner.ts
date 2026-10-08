import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppUpdateService } from '../../../core/app-update/app-update.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-update-banner',
  imports: [TranslatePipe],
  templateUrl: './update-banner.html',
  styleUrl: './update-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateBanner {
  protected readonly appUpdate = inject(AppUpdateService);
}
