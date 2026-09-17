import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type AppLanguage = 'en' | 'es';

const STORAGE_KEY = 'redsana-lang';
const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['en', 'es'];
const DEFAULT_LANGUAGE: AppLanguage = 'es';

/**
 * Servicio de traducción propio y minimalista: carga en.json/es.json bajo
 * demanda. No se agregó ngx-translate ni ninguna librería porque el único
 * requisito (diccionario plano por idioma + interpolación simple) cabe en
 * unas pocas líneas con HttpClient + signals.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly http = inject(HttpClient);

  readonly language = signal<AppLanguage>(this.readInitialLanguage());
  private readonly dictionary = signal<Record<string, unknown>>({});

  async load(lang: AppLanguage = this.language()): Promise<void> {
    const dict = await firstValueFrom(
      this.http.get<Record<string, unknown>>(`assets/i18n/${lang}.json`)
    );
    this.dictionary.set(dict);
    this.language.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const value = this.resolveKey(key);
    if (value === undefined) {
      return key;
    }
    if (!params) {
      return value;
    }
    return Object.entries(params).reduce(
      (text, [name, replacement]) => text.replaceAll(`{{${name}}}`, String(replacement)),
      value
    );
  }

  private resolveKey(key: string): string | undefined {
    const segments = key.split('.');
    let current: unknown = this.dictionary();
    for (const segment of segments) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === 'string' ? current : undefined;
  }

  private readInitialLanguage(): AppLanguage {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGUAGES.includes(stored as AppLanguage)) {
      return stored as AppLanguage;
    }
    const browserLang = navigator.language.slice(0, 2);
    return SUPPORTED_LANGUAGES.includes(browserLang as AppLanguage)
      ? (browserLang as AppLanguage)
      : DEFAULT_LANGUAGE;
  }
}
