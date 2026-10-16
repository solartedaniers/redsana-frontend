import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { I18nService } from './i18n.service';

const DOCUMENT_TITLE_KEY = 'common.documentTitle';

/** Mantiene el título de la pestaña y el lang de <html> en el idioma activo (lectores de pantalla y traductores lo leen). */
@Injectable({ providedIn: 'root' })
export class DocumentMetadataService {
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);

  constructor() {
    // Se recalcula al cargar el diccionario y al cambiar de idioma.
    effect(() => {
      this.document.documentElement.lang = this.i18n.language();
      this.title.setTitle(this.i18n.translate(DOCUMENT_TITLE_KEY));
    });
  }
}
