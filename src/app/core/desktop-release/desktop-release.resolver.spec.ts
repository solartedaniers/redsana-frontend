import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DESKTOP_RELEASE_CONFIG, DesktopReleaseConfig } from './desktop-release.config';
import { DesktopReleaseResolver } from './desktop-release.resolver';
import { selectInstallerAsset } from './installer-asset.selector';

const CONFIG: DesktopReleaseConfig = {
  latestReleaseUrl: 'https://api.test/repos/owner/repo/releases/latest',
  installerAssetSuffix: '-setup.exe',
  fallbackUrl: 'https://example.test/releases/latest',
};
const asset = (name: string) => ({ name, browser_download_url: `https://example.test/download/${name}` });

describe('selectInstallerAsset', () => {
  it('elige el .exe del instalador e ignora .msi, .sig y .zip', () => {
    const assets = [asset('RedSana_1.2.0_x64_en-US.msi'), asset('RedSana_1.2.0_x64-setup.exe.sig'), asset('RedSana_1.2.0_x64.zip'), asset('RedSana_1.2.0_x64-setup.exe')];
    expect(selectInstallerAsset(assets, CONFIG.installerAssetSuffix)?.name).toBe('RedSana_1.2.0_x64-setup.exe');
  });

  it('devuelve null si ningún asset coincide', () => {
    expect(selectInstallerAsset([asset('RedSana_1.2.0_x64_en-US.msi')], CONFIG.installerAssetSuffix)).toBeNull();
  });
});

describe('DesktopReleaseResolver', () => {
  let resolver: DesktopReleaseResolver;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DESKTOP_RELEASE_CONFIG, useValue: CONFIG }],
    });
    resolver = TestBed.inject(DesktopReleaseResolver);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('resuelve la descarga directa del instalador y la cachea durante la sesión', async () => {
    const first = firstValueFrom(resolver.resolve());
    http.expectOne(CONFIG.latestReleaseUrl).flush({ assets: [asset('RedSana_2.0.0_x64-setup.exe')] });

    expect(await first).toEqual({ kind: 'installer', url: 'https://example.test/download/RedSana_2.0.0_x64-setup.exe' });
    expect(await firstValueFrom(resolver.resolve())).toEqual(await first);
    http.expectNone(CONFIG.latestReleaseUrl);
  });

  it('usa la página del release si no hay asset que coincida', async () => {
    const result = firstValueFrom(resolver.resolve());
    http.expectOne(CONFIG.latestReleaseUrl).flush({ assets: [asset('RedSana_2.0.0_x64_en-US.msi')] });

    expect(await result).toEqual({ kind: 'fallback', url: CONFIG.fallbackUrl });
  });

  it('usa la página del release si la API falla (sin red o límite de peticiones) y no cachea el fallo', async () => {
    const result = firstValueFrom(resolver.resolve());
    http.expectOne(CONFIG.latestReleaseUrl).flush('rate limited', { status: 403, statusText: 'Forbidden' });
    expect(await result).toEqual({ kind: 'fallback', url: CONFIG.fallbackUrl });

    const retry = firstValueFrom(resolver.resolve());
    http.expectOne(CONFIG.latestReleaseUrl).error(new ProgressEvent('error'));
    expect(await retry).toEqual({ kind: 'fallback', url: CONFIG.fallbackUrl });
  });
});
