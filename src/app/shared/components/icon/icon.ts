import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

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
  | 'computer'
  | 'download'
  | 'menu';

// Set fijo de iconos en un solo componente: evita repetir SVGs en sidebar,
// top-bar y alertas, y mantiene el estilo (stroke, grosor) consistente.
@Component({
  selector: 'app-icon',
  imports: [],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Every icon exposes its own color token as --icon-tone; each context
  // decides whether to paint with it (color: var(--icon-tone)) or keep currentColor.
  host: { '[style.--icon-tone]': 'tone()' },
})
export class Icon {
  readonly name = input.required<IconName>();

  protected readonly tone = computed(() => `var(--color-icon-${this.name()}, currentColor)`);
}
