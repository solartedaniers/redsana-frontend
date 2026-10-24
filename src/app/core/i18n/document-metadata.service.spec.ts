import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AppLanguage, I18nService } from './i18n.service';
import { DocumentMetadataService } from './document-metadata.service';
import { SEO_CONFIG } from './seo.config';

const TEXTS: Record<AppLanguage, Record<string, string>> = {
  es: {
    'common.documentTitle': 'RedSana · Clínica de redes domésticas',
    'common.appName': 'RedSana',
    'common.seo.description': 'Descripción en español',
    'common.seo.ogLocale': 'es_ES',
  },
  en: {
    'common.documentTitle': 'RedSana · Home network clinic',
    'common.appName': 'RedSana',
    'common.seo.description': 'English description',
    'common.seo.ogLocale': 'en_US',
  },
};

@Component({ template: '' })
class Page {}

async function setup(initial: AppLanguage, url = '/') {
  const language = signal<AppLanguage>(initial);
  TestBed.configureTestingModule({
    providers: [
      { provide: I18nService, useValue: { language, translate: (key: string) => TEXTS[language()][key] ?? key } },
      provideRouter([
        {
          path: '',
          pathMatch: 'full',
          data: { [SEO_CONFIG.indexableRouteDataKey]: true },
          children: [{ path: '', component: Page }],
        },
        { path: 'auth/login', component: Page },
      ]),
    ],
  });
  TestBed.inject(DocumentMetadataService);
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  TestBed.tick();
  return { language, router, title: TestBed.inject(Title) };
}

const meta = (selector: string) => document.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content ?? null;
const canonical = () =>
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href') ?? null;

describe('DocumentMetadataService', () => {
  afterEach(() =>
    document.head.querySelectorAll('meta[name], meta[property], link[rel="canonical"]').forEach((tag) => tag.remove()),
  );

  it('toma el título de la pestaña de i18n y el lang del idioma activo', async () => {
    const { title } = await setup('es');

    expect(title.getTitle()).toBe(TEXTS.es['common.documentTitle']);
    expect(document.documentElement.lang).toBe('es');
  });

  it('al cambiar de idioma actualiza título, lang, descripción y etiquetas para redes', async () => {
    const { language, title } = await setup('es');

    language.set('en');
    TestBed.tick();

    expect(title.getTitle()).toBe(TEXTS.en['common.documentTitle']);
    expect(document.documentElement.lang).toBe('en');
    expect(meta('name="description"')).toBe('English description');
    expect(meta('property="og:locale"')).toBe('en_US');
    expect(meta('name="twitter:title"')).toBe(TEXTS.en['common.documentTitle']);
  });

  it('la landing es indexable, con canónica, Open Graph y Twitter Card sobre WEB_APP_URL', async () => {
    await setup('es');
    const site = `${environment.webAppUrl}/`;

    expect(meta('name="robots"')).toBe(SEO_CONFIG.robots.indexable);
    expect(canonical()).toBe(site);
    expect(meta('property="og:url"')).toBe(site);
    expect(meta('property="og:title"')).toBe(TEXTS.es['common.documentTitle']);
    expect(meta('property="og:description"')).toBe('Descripción en español');
    expect(meta('property="og:image"')).toBe(`${environment.webAppUrl}/${SEO_CONFIG.imagePath}`);
    expect(meta('name="twitter:card"')).toBe(SEO_CONFIG.twitterCard);
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
  });

  it('cualquier otra ruta lleva noindex y no tiene canónica ni og:url', async () => {
    await setup('es', '/auth/login');

    expect(meta('name="robots"')).toBe(SEO_CONFIG.robots.private);
    expect(canonical()).toBeNull();
    expect(meta('property="og:url"')).toBeNull();
  });

  it('antes de la primera navegación no toca la canónica ni robots que traiga el HTML prerenderizado', () => {
    const prerendered = document.createElement('link');
    prerendered.setAttribute('rel', 'canonical');
    prerendered.setAttribute('href', 'https://prerenderizado.invalid/');
    document.head.appendChild(prerendered);
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: { language: signal<AppLanguage>('es'), translate: (key: string) => key } },
        provideRouter([]),
      ],
    });

    TestBed.inject(DocumentMetadataService);
    TestBed.tick();

    expect(canonical()).toBe('https://prerenderizado.invalid/');
    expect(meta('name="robots"')).toBeNull();
  });

  it('al salir de la landing quita la canónica y al volver la pone una sola vez', async () => {
    const { router } = await setup('es');

    await router.navigateByUrl('/auth/login');
    TestBed.tick();
    expect(canonical()).toBeNull();

    await router.navigateByUrl('/');
    TestBed.tick();
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(meta('name="robots"')).toBe(SEO_CONFIG.robots.indexable);
  });
});
