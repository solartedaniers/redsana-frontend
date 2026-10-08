import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ThemeToggle } from '../theme-toggle/theme-toggle';
import { LanguageToggle } from '../language-toggle/language-toggle';
import { Icon } from '../icon/icon';
import { BrandMark } from '../brand-mark/brand-mark';
import { APP_PATHS } from '../../../core/routing/app-paths';

@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, TranslatePipe, ThemeToggle, LanguageToggle, Icon, BrandMark],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly paths = APP_PATHS;
  protected readonly auth = inject(AuthService);
  readonly signOut = output<void>();
  /** Abre/cierra el menú lateral; el botón solo se ve en pantallas angostas (ver app-shell-layout.scss). */
  readonly menuToggle = output<void>();
  readonly isMenuOpen = input(false);
}
