import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  Provider,
  Type,
  inject,
  provideAppInitializer,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { SwRegistrationOptions, provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { I18nService } from './core/i18n/i18n.service';
import { AuthRepository } from './core/auth/auth.repository';
import { SupabaseAuthRepository } from './core/auth/auth-supabase.repository';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { NetworkMetricsRepository } from './core/repositories/network-metrics.repository';
import { NetworkMetricsHttpRepository } from './core/repositories/network-metrics-http.repository';
import { SecurityAssistantRepository } from './core/repositories/security-assistant.repository';
import { SecurityAssistantHttpRepository } from './core/repositories/security-assistant-http.repository';
import { AlertsRepository } from './core/repositories/alerts.repository';
import { AlertsHttpRepository } from './core/repositories/alerts-http.repository';
import { DevicesRepository } from './core/repositories/devices.repository';
import { DevicesHttpRepository } from './core/repositories/devices-http.repository';
import { AdminMetricsRepository } from './core/repositories/admin-metrics.repository';
import { AdminMetricsHttpRepository } from './core/repositories/admin-metrics-http.repository';
import { NetworkSupervisionRepository } from './core/repositories/network-supervision.repository';
import { NetworkSupervisionHttpRepository } from './core/repositories/network-supervision-http.repository';
import { UsersRepository } from './core/repositories/users.repository';
import { UsersHttpRepository } from './core/repositories/users-http.repository';
import { NetworkMeasurementGateway } from './core/network-measurement/network-measurement.gateway';
import { NetworkMeasurementTauriGateway } from './core/network-measurement/network-measurement-tauri.gateway';
import { NetworkMeasurementWebGateway } from './core/network-measurement/network-measurement-web.gateway';
import { NetworkMeasurementService } from './core/network-measurement/network-measurement.service';
import { WifiEncryptionGateway } from './core/wifi-encryption/wifi-encryption.gateway';
import { WifiEncryptionTauriGateway } from './core/wifi-encryption/wifi-encryption-tauri.gateway';
import { WifiEncryptionWebGateway } from './core/wifi-encryption/wifi-encryption-web.gateway';
import { LanScanGateway } from './core/lan-scan/lan-scan.gateway';
import { LanScanTauriGateway } from './core/lan-scan/lan-scan-tauri.gateway';
import { LanScanWebGateway } from './core/lan-scan/lan-scan-web.gateway';
import { AvatarStorageGateway } from './core/avatar-storage/avatar-storage.gateway';
import { SupabaseAvatarStorageGateway } from './core/avatar-storage/avatar-storage-supabase.gateway';
import { RuntimeEnvironmentService } from './core/runtime/runtime-environment.service';

// Los gateways que hablan con el SO tienen una versión nativa (Tauri) y otra
// de navegador; se elige aquí una sola vez para que ningún componente sepa cuál usa.
function provideByRuntime<T>(token: abstract new () => T, desktop: Type<T>, web: Type<T>): Provider {
  return { provide: token, useFactory: () => new (inject(RuntimeEnvironmentService).isDesktop ? desktop : web)() };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),

    // Cada dominio depende de su clase abstracta, no de esta implementación
    // concreta (HTTP/Supabase/Tauri): cambiar de proveedor de datos es
    // solo tocar el useClass de aquí, sin tocar servicios ni componentes.
    { provide: AuthRepository, useClass: SupabaseAuthRepository },
    { provide: NetworkMetricsRepository, useClass: NetworkMetricsHttpRepository },
    { provide: SecurityAssistantRepository, useClass: SecurityAssistantHttpRepository },
    { provide: AlertsRepository, useClass: AlertsHttpRepository },
    { provide: DevicesRepository, useClass: DevicesHttpRepository },
    { provide: AdminMetricsRepository, useClass: AdminMetricsHttpRepository },
    { provide: NetworkSupervisionRepository, useClass: NetworkSupervisionHttpRepository },
    { provide: UsersRepository, useClass: UsersHttpRepository },
    provideByRuntime(NetworkMeasurementGateway, NetworkMeasurementTauriGateway, NetworkMeasurementWebGateway),
    provideByRuntime(WifiEncryptionGateway, WifiEncryptionTauriGateway, WifiEncryptionWebGateway),
    provideByRuntime(LanScanGateway, LanScanTauriGateway, LanScanWebGateway),
    { provide: AvatarStorageGateway, useClass: SupabaseAvatarStorageGateway },

    // Carga idioma y restaura sesión antes de renderizar: evita parpadeo de
    // claves crudas y evita un salto visual login->dashboard en cada recarga.
    provideAppInitializer(() => inject(I18nService).load()),
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // start() dispara su propio ciclo periódico en segundo plano; no hay nada que esperar aquí.
    provideAppInitializer(() => inject(NetworkMeasurementService).start()),

    // En Tauri los archivos ya vienen empaquetados en el instalable: un service
    // worker solo agregaría una caché duplicada que puede servir versiones viejas.
    provideServiceWorker('ngsw-worker.js'),
    {
      provide: SwRegistrationOptions,
      useFactory: () => ({
        enabled: !isDevMode() && !inject(RuntimeEnvironmentService).isDesktop,
        registrationStrategy: 'registerWhenStable:30000',
      }),
    },
  ],
};
