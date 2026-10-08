import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { LanguageToggle } from '../../shared/components/language-toggle/language-toggle';
import { NetworkBackground } from '../../shared/components/network-background/network-background';
import { BrandMark } from '../../shared/components/brand-mark/brand-mark';
import { routeTransitionAnimation } from '../../core/animations/route-transition.animation';
import { APP_PATHS } from '../../core/routing/app-paths';

// Wraps the public screens (landing and auth) in a chart sheet over the 3D
// background, the only place it exists: no sidebar/top bar because there is
// no session yet. The background lives here (not in each screen) so it is not
// rebuilt when navigating between login/register/recovery.
@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink, RouterOutlet, TranslatePipe, ThemeToggle, LanguageToggle, NetworkBackground, BrandMark],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [routeTransitionAnimation],
})
export class AuthLayout {
  protected readonly paths = APP_PATHS;
}
