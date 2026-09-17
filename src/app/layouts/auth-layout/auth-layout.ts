import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { LanguageToggle } from '../../shared/components/language-toggle/language-toggle';
import { routeTransitionAnimation } from '../../core/animations/route-transition.animation';

// Envuelve las pantallas de auth en una tarjeta centrada: sin sidebar/topbar
// porque todavía no hay sesión ni rol que mostrar.
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, TranslatePipe, ThemeToggle, LanguageToggle],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [routeTransitionAnimation],
})
export class AuthLayout {}
