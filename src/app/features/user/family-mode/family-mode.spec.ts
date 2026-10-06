import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FAMILY_DNS } from '../../../core/domain/family-dns';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FamilyMode } from './family-mode';

describe('FamilyMode', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
    const fixture = TestBed.createComponent(FamilyMode);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra los 5 pasos de la guía y los DNS de filtrado', async () => {
    const element = await render();

    expect(element.querySelectorAll('.family-steps li')).toHaveLength(5);
    expect([...element.querySelectorAll('.family-dns dd')].map((dd) => dd.textContent?.trim())).toEqual([
      FAMILY_DNS.primary,
      FAMILY_DNS.secondary,
    ]);
  });

  it('nunca pide la contraseña del router: la pantalla no tiene ningún campo de entrada', async () => {
    const element = await render();

    expect(element.querySelectorAll('input, form')).toHaveLength(0);
  });

  it('el botón abre el asistente con el contexto del modo familiar, sin quitar la guía fija', async () => {
    const element = await render();

    const askButton = element.querySelector<HTMLAnchorElement>('a.family-ask')!;
    expect(askButton.getAttribute('href')).toBe('/user/security-assistant?topic=family_mode');
    expect(element.querySelectorAll('.family-steps li')).toHaveLength(5);
  });

  it('numera cada paso y resalta los DNS del paso 4 como chips', async () => {
    // Plantilla real del paso 4 (el diccionario no se carga en los tests).
    const setDnsTemplate = 'Escribe {{primary}} como DNS primario y {{secondary}} como DNS secundario.';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: I18nService,
          useValue: { translate: (key: string) => (key === 'user.familyMode.steps.setDns' ? setDnsTemplate : key) },
        },
      ],
    });
    const fixture = TestBed.createComponent(FamilyMode);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect([...element.querySelectorAll('.step-number')].map((n) => n.textContent?.trim())).toEqual(['1', '2', '3', '4', '5']);
    expect([...element.querySelectorAll('.dns-chip')].map((c) => c.textContent?.trim())).toEqual([
      FAMILY_DNS.primary,
      FAMILY_DNS.secondary,
    ]);
  });
});
