import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { I18nService } from './core/i18n/i18n.service';
import { AuthRepository } from './core/auth/auth.repository';
import { SupabaseAuthRepository } from './core/auth/auth-supabase.repository';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { NetworkMetricsRepository } from './core/repositories/network-metrics.repository';
import { NetworkMetricsHttpRepository } from './core/repositories/network-metrics-http.repository';
import { SecurityAssistantRepository } from './core/repositories/security-assistant.repository';
import { MockSecurityAssistantRepository } from './core/repositories/security-assistant-mock.repository';
import { AlertsRepository } from './core/repositories/alerts.repository';
import { AlertsHttpRepository } from './core/repositories/alerts-http.repository';
import { DevicesRepository } from './core/repositories/devices.repository';
import { DevicesHttpRepository } from './core/repositories/devices-http.repository';
import { AdminMetricsRepository } from './core/repositories/admin-metrics.repository';
import { MockAdminMetricsRepository } from './core/repositories/admin-metrics-mock.repository';
import { NetworkSupervisionRepository } from './core/repositories/network-supervision.repository';
import { NetworkSupervisionHttpRepository } from './core/repositories/network-supervision-http.repository';
import { UsersRepository } from './core/repositories/users.repository';
import { UsersHttpRepository } from './core/repositories/users-http.repository';
import { NetworkMeasurementGateway } from './core/network-measurement/network-measurement.gateway';
import { NetworkMeasurementTauriGateway } from './core/network-measurement/network-measurement-tauri.gateway';
import { NetworkMeasurementService } from './core/network-measurement/network-measurement.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),

    // Repositorios mock: para conectar el backend real basta con reemplazar
    // el useClass de cada uno por su implementación HTTP/Supabase, sin tocar
    // servicios ni componentes que dependen de la clase abstracta.
    { provide: AuthRepository, useClass: SupabaseAuthRepository },
    { provide: NetworkMetricsRepository, useClass: NetworkMetricsHttpRepository },
    { provide: SecurityAssistantRepository, useClass: MockSecurityAssistantRepository },
    { provide: AlertsRepository, useClass: AlertsHttpRepository },
    { provide: DevicesRepository, useClass: DevicesHttpRepository },
    { provide: AdminMetricsRepository, useClass: MockAdminMetricsRepository },
    { provide: NetworkSupervisionRepository, useClass: NetworkSupervisionHttpRepository },
    { provide: UsersRepository, useClass: UsersHttpRepository },
    { provide: NetworkMeasurementGateway, useClass: NetworkMeasurementTauriGateway },

    // Carga idioma y restaura sesión antes de renderizar: evita parpadeo de
    // claves crudas y evita un salto visual login->dashboard en cada recarga.
    provideAppInitializer(() => inject(I18nService).load()),
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // start() dispara su propio ciclo periódico en segundo plano; no hay nada que esperar aquí.
    provideAppInitializer(() => inject(NetworkMeasurementService).start()),
  ],
};
