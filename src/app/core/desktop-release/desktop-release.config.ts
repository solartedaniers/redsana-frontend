import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface DesktopReleaseConfig {
  /** Endpoint de la API de GitHub con el último release publicado. */
  readonly latestReleaseUrl: string;
  /** El instalador de Windows es el asset cuyo nombre termina así (sin distinguir mayúsculas). */
  readonly installerAssetSuffix: string;
  /** Página del release que se abre cuando no se puede resolver el instalador. */
  readonly fallbackUrl: string;
}

export const DESKTOP_RELEASE_CONFIG = new InjectionToken<DesktopReleaseConfig>('DESKTOP_RELEASE_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    latestReleaseUrl: `${environment.githubApiUrl}/repos/${environment.desktopReleaseRepo}/releases/latest`,
    installerAssetSuffix: environment.desktopInstallerAssetSuffix,
    fallbackUrl: environment.desktopDownloadUrl,
  }),
});
