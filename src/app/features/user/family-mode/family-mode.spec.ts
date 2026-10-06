import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FAMILY_DNS } from '../../../core/domain/family-dns';
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
});
