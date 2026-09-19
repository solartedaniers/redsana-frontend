import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'dashboard'
  | 'shield'
  | 'bell'
  | 'devices'
  | 'home'
  | 'users'
  | 'user'
  | 'logout'
  | 'chevron-right'
  | 'warning'
  | 'check'
  | 'mail'
  | 'lock'
  | 'eye'
  | 'eye-off'
  | 'clock'
  | 'plus'
  | 'edit'
  | 'phone'
  | 'computer';

// Set fijo de iconos en un solo componente: evita repetir SVGs en sidebar,
// top-bar y alertas, y mantiene el estilo (stroke, grosor) consistente.
@Component({
  selector: 'app-icon',
  imports: [],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
}
