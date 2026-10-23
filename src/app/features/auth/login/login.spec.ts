import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ACCOUNT_SUSPENDED_ERROR_KEY, AccountSuspendedError } from '../../../core/auth/account-suspended.error';
import { AuthService } from '../../../core/auth/auth.service';
import { DEMO_LOGIN_CONFIG, DemoLoginConfig, readDemoLoginConfig } from '../../../core/auth/demo-login.config';
import { BackendWakeUpService } from '../../../core/backend/backend-wake-up.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { Login } from './login';

// Valores ficticios: las credenciales reales de demo solo viven en las variables de entorno del despliegue.
const DEMO: DemoLoginConfig = { enabled: true, email: 'demo@example.invalid', password: 'Ejemplo-Clave-2026' };
const OFF: DemoLoginConfig = { enabled: false, email: '', password: '' };

async function render(
  demoLogin: DemoLoginConfig,
  signIn: ReturnType<typeof vi.fn> = vi.fn(() => of({ user: { role: 'user' } })),
  accountSuspended = false
) {
  const wakeUp = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter([]),
      { provide: AuthService, useValue: { signIn, accountSuspended: signal(accountSuspended) } },
      { provide: DEMO_LOGIN_CONFIG, useValue: demoLogin },
      { provide: BackendWakeUpService, useValue: { wakeUp } },
    ],
  });
  // Sin las rutas reales, entrar no debe intentar una navegación de verdad.
  const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Login);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const [email, password] = element.querySelectorAll<HTMLInputElement>('input');
  return { fixture, element, email, password, signIn, navigateByUrl, wakeUp };
}

describe('Login', () => {
  it('al abrirse despierta el backend una sola vez', async () => {
    const { wakeUp } = await render(OFF);

    expect(wakeUp).toHaveBeenCalledOnce();
  });

  it('sin el interruptor los campos llegan vacíos y no hay aviso de ejemplo', async () => {
    const { element, email, password } = await render(OFF);

    expect(email.value).toBe('');
    expect(password.value).toBe('');
    expect(element.textContent).not.toContain('auth.login.demoNotice');
  });

  it('con el interruptor precarga las credenciales y muestra el aviso traducible', async () => {
    const { element, email, password } = await render(DEMO);

    expect(email.value).toBe(DEMO.email);
    expect(password.value).toBe(DEMO.password);
    expect(element.querySelector('.credential-notice')?.textContent?.trim()).toBe('auth.login.demoNotice');
  });

  it('precargado sigue validando, mide la contraseña, ofrece recuperarla y entra con esos valores', async () => {
    const { element, signIn, navigateByUrl } = await render(DEMO);

    expect(element.querySelector('app-password-strength-meter')).not.toBeNull();
    expect(element.querySelector('.forgot-link')).not.toBeNull();
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    expect(signIn).toHaveBeenCalledExactlyOnceWith(DEMO.email, DEMO.password);
    expect(navigateByUrl).toHaveBeenCalledWith(APP_PATHS.userDashboard);
  });

  it('borrar el correo precargado vuelve a exigirlo', async () => {
    const { element, email, signIn } = await render(DEMO);

    email.value = '';
    email.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    expect(signIn).not.toHaveBeenCalled();
  });

  it('si la sesión guardada era de una cuenta suspendida, lo avisa al llegar', async () => {
    const { element } = await render(OFF, undefined, true);

    expect(element.querySelector('.form-error')?.textContent?.trim()).toBe(ACCOUNT_SUSPENDED_ERROR_KEY);
  });

  it('entrar con una cuenta suspendida muestra el aviso, no navega y no reintenta', async () => {
    const signIn = vi.fn(() => throwError(() => new AccountSuspendedError()));
    const { fixture, element, navigateByUrl } = await render(DEMO, signIn);

    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(signIn).toHaveBeenCalledOnce();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(element.querySelector('.form-error')?.textContent?.trim()).toBe(ACCOUNT_SUSPENDED_ERROR_KEY);
  });
});

describe('readDemoLoginConfig', () => {
  it('queda apagado si el environment no trae demoLogin (environment.ts escrito a mano)', () => {
    expect(readDemoLoginConfig({})).toEqual(OFF);
  });

  it('queda apagado si falta el correo o la contraseña aunque el interruptor esté encendido', () => {
    expect(readDemoLoginConfig({ demoLogin: { enabled: true, email: 'demo@example.invalid', password: '' } })).toEqual(OFF);
  });

  it('respeta las credenciales cuando el interruptor está encendido', () => {
    expect(readDemoLoginConfig({ demoLogin: DEMO })).toEqual(DEMO);
  });
});
