import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Credenciales de ejemplo del login (requisito académico); vienen de DEMO_LOGIN_* al generar el environment. */
export interface DemoLoginConfig {
  readonly enabled: boolean;
  readonly email: string;
  readonly password: string;
}

const DISABLED_DEMO_LOGIN: DemoLoginConfig = { enabled: false, email: '', password: '' };

/** Un environment.ts escrito a mano puede no traer demoLogin: en ese caso queda apagado en vez de fallar. */
export function readDemoLoginConfig(source: { demoLogin?: Partial<DemoLoginConfig> }): DemoLoginConfig {
  const demoLogin = source.demoLogin;
  if (!demoLogin?.enabled || !demoLogin.email || !demoLogin.password) {
    return DISABLED_DEMO_LOGIN;
  }
  return { enabled: true, email: demoLogin.email, password: demoLogin.password };
}

export const DEMO_LOGIN_CONFIG = new InjectionToken<DemoLoginConfig>('DEMO_LOGIN_CONFIG', {
  providedIn: 'root',
  factory: () => readDemoLoginConfig(environment),
});
