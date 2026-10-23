import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { APP_PATHS } from '../routing/app-paths';
import { I18nService } from './i18n.service';
import { SEO_CONFIG } from './seo.config';

const DOCUMENT_TITLE_KEY = 'common.documentTitle';
const APP_NAME_KEY = 'common.appName';
const DESCRIPTION_KEY = 'common.seo.description';
const OG_LOCALE_KEY = 'common.seo.ogLocale';

/**
 * Mantiene en el idioma activo el título, el lang de <html> (lectores de pantalla y traductores lo leen) y las
 * etiquetas para buscadores y redes. Corre también al prerenderizar, así que la landing sale con todo en el HTML.
 */
@Injectable({ providedIn: 'root' })
export class DocumentMetadataService {
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  // null hasta la primera navegación: así al arrancar no se quita (y vuelve a poner) la canónica del HTML prerenderizado.
  private readonly indexable = signal<boolean | null>(null);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.indexable.set(this.isIndexableRoute()));

    // Se recalcula al cargar el diccionario, al cambiar de idioma y al navegar.
    effect(() => {
      const title = this.i18n.translate(DOCUMENT_TITLE_KEY);
      this.document.documentElement.lang = this.i18n.language();
      this.title.setTitle(title);
      this.applySharingTags(title, this.i18n.translate(DESCRIPTION_KEY));
      const indexable = this.indexable();
      if (indexable !== null) {
        this.applyIndexing(indexable);
      }
    });
  }

  private applySharingTags(title: string, description: string): void {
    const image = `${environment.webAppUrl}/${SEO_CONFIG.imagePath}`;
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:type', content: SEO_CONFIG.ogType });
    this.meta.updateTag({ property: 'og:site_name', content: this.i18n.translate(APP_NAME_KEY) });
    this.meta.updateTag({ property: 'og:locale', content: this.i18n.translate(OG_LOCALE_KEY) });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: SEO_CONFIG.twitterCard });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
  }

  /** La URL canónica solo existe en lo indexable: en el resto diría "esta página es la landing". */
  private applyIndexing(indexable: boolean): void {
    const siteUrl = `${environment.webAppUrl}${APP_PATHS.root}`;
    this.meta.updateTag({ name: 'robots', content: indexable ? SEO_CONFIG.robots.indexable : SEO_CONFIG.robots.private });
    if (indexable) {
      this.meta.updateTag({ property: 'og:url', content: siteUrl });
    } else {
      this.meta.removeTag("property='og:url'");
    }
    this.setCanonical(indexable ? siteUrl : null);
  }

  private setCanonical(url: string | null): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (url === null) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private isIndexableRoute(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.pathFromRoot.some((step) => step.data[SEO_CONFIG.indexableRouteDataKey] === true);
  }
}
