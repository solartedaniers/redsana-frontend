import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Icon } from '../../../../shared/components/icon/icon';

/**
 * Campo de búsqueda de la lista de dispositivos: solo maneja el texto (limpiar, Escape) y
 * muestra el conteo. Quién coincide lo decide DeviceSearchFilter en la pantalla.
 */
@Component({
  selector: 'app-device-search-box',
  imports: [TranslatePipe, Icon],
  templateUrl: './device-search-box.html',
  styleUrl: './device-search-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceSearchBox {
  readonly query = model('');
  /** Coincidencias de la búsqueda activa y total de dispositivos cargados. */
  readonly matchCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly isActive = input.required<boolean>();

  protected clear(field?: HTMLInputElement): void {
    this.query.set('');
    field?.focus();
  }
}
