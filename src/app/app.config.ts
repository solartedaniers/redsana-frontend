import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  Injector,
  Provider,
  Type,
  inject,
  provideAppInitializer,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withNoHttpTransferCache } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { SwRegistrationOptions, provideServiceWorker } from '@angular/service-worker';
import { isTauri } from '@tauri-apps/api/core';
import { routes } from './app.routes';
import { I18nService } from './core/i18n/i18n.service';
import { DocumentMetadataService } from './core/i18n/document-metadata.service';
import { AuthRepository } from './core/auth/auth.repository';
import { SupabaseAuthRepository } from './core/auth/auth-supabase.repository';
import { authInterceptor } from './core/auth/auth.interceptor';
import { pageExitInterceptor } from './core/runtime/page-exit.interceptor';
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
import { AiStatusRepository } from './core/repositories/ai-status.repository';
import { AiStatusHttpRepository } from './core/repositories/ai-status-http.repository';
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
import { RouterPortScanGateway } from './core/router-port-scan/router-port-scan.gateway';
import { NetworkIdentityGateway } from './core/network-identity/network-identity.gateway';
import { NetworkIdentityTauriGateway } from './core/network-identity/network-identity-tauri.gateway';
import { NetworkIdentityWebGateway } from './core/network-identity/network-identity-web.gateway';
import { RouterPortScanTauriGateway } from './core/router-port-scan/router-port-scan-tauri.gateway';
import { RouterPortScanWebGateway } from './core/router-port-scan/router-port-scan-web.gateway';
import { AvatarStorageGateway } from './core/avatar-storage/avatar-storage.gateway';
import { SupabaseAvatarStorageGateway } from './core/avatar-storage/avatar-storage-supabase.gateway';
import { RuntimeEnvironmentService } from './core/runtime/runtime-environment.service';
import { MeasurementDelivery, DirectMeasurementDelivery } from './core/pending-measurements/measurement-delivery';
import { QueuedMeasurementDelivery } from './core/pending-measurements/queued-measurement-delivery';
import { PendingMeasurementRepository } from './core/pending-measurements/pending-measurement.repository';
import { PendingMeasurementTauriRepository } from './core/pending-measurements/pending-measurement-tauri.repository';
import { AiStatusService } from './core/ai-status/ai-status.service';
import { NetworkThresholdsService } from './core/network-thresholds/network-thresholds.service';
import { SecurityScoreConfigService } from './core/security-score-config/security-score-config.service';

// Cada gateway del sistema operativo tiene versión Tauri y de navegador; aquí elijo una sola vez.
function provideByRuntime<T>(token: abstract new () => T, desktop: Type<T>, web: Type<T>): Provider {
  return { provide: token, useFactory: () => new (inject(RuntimeEnvironmentService).isDesktop ? desktop : web)() };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, pageExitInterceptor])),
    provideAnimationsAsync(),
    // Solo la landing prerenderizada se hidrata; en Tauri no (redirige al login). Sin caché de transferencia para que
    // nada del build quede congelado en el HTML.
    ...(isTauri() ? [] : [provideClientHydration(withNoHttpTransferCache())]),

    // Cada dominio depende de su clase abstracta: cambiar de proveedor es tocar solo el useClass de aquí.
    { provide: AuthRepository, useClass: SupabaseAuthRepository },
    { provide: NetworkMetricsRepository, useClass: NetworkMetricsHttpRepository },
    { provide: SecurityAssistantRepository, useClass: SecurityAssistantHttpRepository },
    { provide: AlertsRepository, useClass: AlertsHttpRepository },
    { provide: DevicesRepository, useClass: DevicesHttpRepository },
    { provide: AdminMetricsRepository, useClass: AdminMetricsHttpRepository },
    { provide: NetworkSupervisionRepository, useClass: NetworkSupervisionHttpRepository },
    { provide: UsersRepository, useClass: UsersHttpRepository },
    { provide: AiStatusRepository, useClass: AiStatusHttpRepository },
    provideByRuntime(NetworkMeasurementGateway, NetworkMeasurementTauriGateway, NetworkMeasurementWebGateway),
    provideByRuntime(WifiEncryptionGateway, WifiEncryptionTauriGateway, WifiEncryptionWebGateway),
    provideByRuntime(LanScanGateway, LanScanTauriGateway, LanScanWebGateway),
    provideByRuntime(RouterPortScanGateway, RouterPortScanTauriGateway, RouterPortScanWebGateway),
    provideByRuntime(NetworkIdentityGateway, NetworkIdentityTauriGateway, NetworkIdentityWebGateway),
    provideByRuntime(MeasurementDelivery, QueuedMeasurementDelivery, DirectMeasurementDelivery),
    // Solo la usa la entrega con cola del escritorio; la web no guarda mediciones (ver DirectMeasurementDelivery).
    { provide: PendingMeasurementRepository, useClass: PendingMeasurementTauriRepository },
    { provide: AvatarStorageGateway, useClass: SupabaseAvatarStorageGateway },

    // Cargo el idioma antes de pintar para no mostrar claves crudas; si el diccionario no llega, la app arranca igual.
    provideAppInitializer(() =>
      inject(I18nService)
        .load()
        .catch((error: unknown) => console.error(error)),
    ),
    // Título de la pestaña y lang de <html> desde i18n, en el idioma activo.
    provideAppInitializer(() => void inject(DocumentMetadataService)),
    // La sesión se recupera en segundo plano: el backend dormido en Render tardaba más de un minuto y dejaba la página
    // en blanco. Solo las pantallas protegidas esperan el perfil (ver authGuard y roleGuard).
    provideAppInitializer(() => inject(AuthService).startRestore()),
    // start() lanza su propio ciclo en segundo plano; aquí no hay nada que esperar.
    provideAppInitializer(() => inject(NetworkMeasurementService).start()),
    // Igual: al haber sesión despierta la IA en segundo plano y sigue su estado.
    provideAppInitializer(() => inject(AiStatusService).start()),
    // Los umbrales del estado llegan con la sesión; hasta entonces, y si fallan, valen los de respaldo.
    provideAppInitializer(() => inject(NetworkThresholdsService).start()),
    // Igual con los rangos y pesos del puntaje de seguridad.
    provideAppInitializer(() => inject(SecurityScoreConfigService).start()),
    // Bandeja del sistema y reintento de sesión al arrancar con Windows, solo escritorio: import() los deja en archivos
    // aparte que la web nunca descarga.
    provideAppInitializer(() => {
      if (inject(RuntimeEnvironmentService).isDesktop) {
        const injector = inject(Injector);
        void Promise.all([
          import('./core/desktop-tray/desktop-tray.service'),
          import('./core/desktop-autostart/autostart-session-retry.service'),
        ])
          .then(([{ DesktopTrayService }, { AutostartSessionRetry }]) => {
            injector.get(DesktopTrayService);
            injector.get(AutostartSessionRetry);
          })
          .catch((error: unknown) => console.error(error));
      }
    }),

    // En Tauri los archivos ya vienen en el instalador; un service worker solo duplicaría la caché.
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
