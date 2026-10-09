import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

@Pipe({
  name: 'translate',
  // Impuro a propósito: tiene que reevaluarse cuando cambia el idioma aunque la clave sea la misma.
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string | null | undefined, params?: Record<string, string | number>): string {
    return key ? this.i18n.translate(key, params) : '';
  }
}
