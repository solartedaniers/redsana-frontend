import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ThemeToggle } from '../theme-toggle/theme-toggle';
import { LanguageToggle } from '../language-toggle/language-toggle';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-top-bar',
  imports: [TranslatePipe, ThemeToggle, LanguageToggle, Icon],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly auth = inject(AuthService);
  readonly signOut = output<void>();
}
