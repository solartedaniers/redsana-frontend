import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

@Pipe({
  name: 'translate',
  // Impuro a propósito: debe re-evaluar cuando I18nService cambia de idioma,
  // un cambio que no altera la referencia del argumento `key` en la plantilla.
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string | null | undefined, params?: Record<string, string | number>): string {
    return key ? this.i18n.translate(key, params) : '';
  }
}
