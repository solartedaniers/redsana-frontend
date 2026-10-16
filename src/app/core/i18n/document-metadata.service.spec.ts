import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { AppLanguage, I18nService } from './i18n.service';
import { DocumentMetadataService } from './document-metadata.service';

const TITLES: Record<AppLanguage, string> = { es: 'RedSana · Clínica de redes domésticas', en: 'RedSana · Home network clinic' };

function setup(initial: AppLanguage) {
  const language = signal<AppLanguage>(initial);
  TestBed.configureTestingModule({
    providers: [{ provide: I18nService, useValue: { language, translate: () => TITLES[language()] } }],
  });
  TestBed.inject(DocumentMetadataService);
  TestBed.tick();
  return { language, title: TestBed.inject(Title) };
}

describe('DocumentMetadataService', () => {
  it('toma el título de la pestaña de i18n y el lang del idioma activo', () => {
    const { title } = setup('es');

    expect(title.getTitle()).toBe(TITLES.es);
    expect(document.documentElement.lang).toBe('es');
  });

  it('al cambiar de idioma actualiza los dos', () => {
    const { language, title } = setup('es');

    language.set('en');
    TestBed.tick();

    expect(title.getTitle()).toBe(TITLES.en);
    expect(document.documentElement.lang).toBe('en');
  });
});
