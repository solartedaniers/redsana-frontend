import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface DesktopReleaseConfig {
  /** GitHub API endpoint of the repository's latest published release. */
  readonly latestReleaseUrl: string;
  /** The Windows installer is the asset whose name ends with this (case-insensitive). */
  readonly installerAssetSuffix: string;
  /** Opened instead when the installer cannot be resolved (release page). */
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
