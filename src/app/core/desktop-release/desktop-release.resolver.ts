import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { DESKTOP_RELEASE_CONFIG } from './desktop-release.config';
import { ReleaseAsset, selectInstallerAsset } from './installer-asset.selector';

/** 'installer': descarga directa del .exe. 'fallback': página del release. */
export interface DesktopInstallerLink {
  readonly kind: 'installer' | 'fallback';
  readonly url: string;
}

interface GitHubRelease {
  readonly assets: readonly ReleaseAsset[];
}

// Nunca falla: si algo sale mal devuelve la página del release. Solo se guardan en memoria los enlaces buenos.
@Injectable({ providedIn: 'root' })
export class DesktopReleaseResolver {
  private readonly http = inject(HttpClient);
  private readonly config = inject(DESKTOP_RELEASE_CONFIG);
  private cached: DesktopInstallerLink | null = null;

  resolve(): Observable<DesktopInstallerLink> {
    if (this.cached) {
      return of(this.cached);
    }
    return this.http.get<GitHubRelease>(this.config.latestReleaseUrl).pipe(
      map((release) => selectInstallerAsset(release.assets ?? [], this.config.installerAssetSuffix)),
      map((asset): DesktopInstallerLink => (asset ? { kind: 'installer', url: asset.browser_download_url } : this.fallback())),
      catchError(() => of(this.fallback())),
      tap((link) => {
        if (link.kind === 'installer') {
          this.cached = link;
        }
      })
    );
  }

  private fallback(): DesktopInstallerLink {
    return { kind: 'fallback', url: this.config.fallbackUrl };
  }
}
