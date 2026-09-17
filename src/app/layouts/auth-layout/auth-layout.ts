import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { LanguageToggle } from '../../shared/components/language-toggle/language-toggle';
import { NetworkBackground } from '../../shared/components/network-background/network-background';
import { routeTransitionAnimation } from '../../core/animations/route-transition.animation';

// Envuelve las pantallas de auth en una tarjeta centrada sobre un fondo 3D
// compartido: sin sidebar/topbar porque todavía no hay sesión ni rol que
// mostrar. El fondo vive aquí (y no en cada pantalla) para no reiniciarse
// al navegar entre login/registro/recuperación.
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, TranslatePipe, ThemeToggle, LanguageToggle, NetworkBackground],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [routeTransitionAnimation],
})
export class AuthLayout {}
