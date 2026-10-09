import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { LanguageToggle } from '../../shared/components/language-toggle/language-toggle';
import { NetworkBackground } from '../../shared/components/network-background/network-background';
import { BrandMark } from '../../shared/components/brand-mark/brand-mark';
import { routeTransitionAnimation } from '../../core/animations/route-transition.animation';
import { APP_PATHS } from '../../core/routing/app-paths';

// Envuelve las pantallas públicas en la hoja clínica sobre el fondo 3D, el único lugar donde existe.
// El fondo vive aquí para no reconstruirse al navegar entre login, registro y recuperación.
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
