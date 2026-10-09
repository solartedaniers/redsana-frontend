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
  | 'menu'
  | 'search';

// Todos los iconos en un componente para no repetir SVGs y mantener el mismo trazo.
@Component({
  selector: 'app-icon',
  imports: [],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Cada icono expone su color como --icon-tone; cada sitio decide si lo usa o se queda con currentColor.
  host: { '[style.--icon-tone]': 'tone()' },
})
export class Icon {
  readonly name = input.required<IconName>();

  protected readonly tone = computed(() => `var(--color-icon-${this.name()}, currentColor)`);
}
