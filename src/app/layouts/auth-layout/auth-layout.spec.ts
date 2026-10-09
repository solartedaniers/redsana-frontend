import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AuthLayout } from './auth-layout';

describe('AuthLayout', () => {
  it('la marca del encabezado lleva a la pantalla de inicio', async () => {
    // jsdom no implementa matchMedia y ThemeService lo usa para el tema inicial.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([]), provideNoopAnimations()] });
    const fixture = TestBed.createComponent(AuthLayout);
    fixture.detectChanges();
    await fixture.whenStable();

    const brand = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a.brand-cluster');
    expect(brand?.getAttribute('href')).toBe('/');
    vi.unstubAllGlobals();
  });
});
