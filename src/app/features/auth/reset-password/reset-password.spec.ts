import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ResetPassword } from './reset-password';

async function render(auth: Partial<AuthService>): Promise<{ element: HTMLElement; detect: () => Promise<void> }> {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  const fixture = TestBed.createComponent(ResetPassword);
  const detect = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await detect();
  return { element: fixture.nativeElement as HTMLElement, detect };
}

function fill(element: HTMLElement, password: string, confirm: string): void {
  const [first, second] = element.querySelectorAll<HTMLInputElement>('input');
  first.value = password;
  first.dispatchEvent(new Event('input'));
  second.value = confirm;
  second.dispatchEvent(new Event('input'));
  element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
}

describe('ResetPassword', () => {
  it('sin sesión de recuperación (enlace vencido) no muestra el formulario y ofrece pedir otro enlace', async () => {
    const { element } = await render({ hasRecoverySession: () => of(false) });

    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('.form-error')?.textContent?.trim()).toBe('auth.resetPassword.invalidLink');
  });

  it('con sesión de recuperación fija la nueva contraseña sin pedir la actual', async () => {
    const resetPassword = vi.fn(() => of(undefined));
    const { element, detect } = await render({ hasRecoverySession: () => of(true), resetPassword });

    fill(element, 'nueva-clave-segura', 'nueva-clave-segura');
    await detect();

    expect(resetPassword).toHaveBeenCalledExactlyOnceWith('nueva-clave-segura');
    expect(element.querySelector('.form-success')?.textContent?.trim()).toBe('auth.resetPassword.successMessage');
  });

  it('no envía si las contraseñas no coinciden o son cortas', async () => {
    const resetPassword = vi.fn(() => of(undefined));
    const { element, detect } = await render({ hasRecoverySession: () => of(true), resetPassword });

    fill(element, 'corta', 'corta');
    await detect();
    fill(element, 'nueva-clave-segura', 'otra-clave-segura');
    await detect();

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('muestra el error de Supabase si falla', async () => {
    const { element, detect } = await render({
      hasRecoverySession: () => of(true),
      resetPassword: () => throwError(() => new Error('auth.errors.unknown')),
    });

    fill(element, 'nueva-clave-segura', 'nueva-clave-segura');
    await detect();

    expect(element.querySelector('.form-error')?.textContent?.trim()).toBe('auth.errors.unknown');
  });
});
