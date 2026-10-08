import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DesktopInstallerLink, DesktopReleaseResolver } from '../../../core/desktop-release/desktop-release.resolver';
import { RuntimeEnvironmentService } from '../../../core/runtime/runtime-environment.service';
import { DesktopDownloadButton } from './desktop-download-button';

function render(isDesktop: boolean, links = new Subject<DesktopInstallerLink>()) {
  const resolve = vi.fn(() => links);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: RuntimeEnvironmentService, useValue: { isDesktop } },
      { provide: DesktopReleaseResolver, useValue: { resolve } },
    ],
  });
  const fixture = TestBed.createComponent(DesktopDownloadButton);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, resolve, links };
}

describe('DesktopDownloadButton', () => {
  afterEach(() => vi.restoreAllMocks());

  it('en la web muestra el botón con el texto de la landing y la página del release como respaldo sin JS', () => {
    const link = render(false).element.querySelector('a.submit-button');

    expect(link?.getAttribute('href')).toBe(environment.desktopDownloadUrl);
    expect(link?.textContent?.trim()).toBe('landing.download');
  });

  it('en la app de escritorio no se muestra', () => {
    expect(render(true).element.querySelector('a')).toBeNull();
  });

  it('mientras resuelve muestra el estado de carga e ignora el doble clic', () => {
    const { fixture, element, resolve } = render(false);
    const link = element.querySelector<HTMLAnchorElement>('a.submit-button')!;

    link.click();
    link.click();
    fixture.detectChanges();

    expect(resolve).toHaveBeenCalledOnce();
    expect(link.getAttribute('aria-busy')).toBe('true');
    expect(link.textContent?.trim()).toBe('landing.downloadPreparing');
  });

  it('si no se pudo resolver el instalador abre la página del release y lo avisa', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const { fixture, element, links } = render(false);

    element.querySelector<HTMLAnchorElement>('a.submit-button')!.click();
    links.next({ kind: 'fallback', url: environment.desktopDownloadUrl });
    fixture.detectChanges();

    expect(open).toHaveBeenCalledWith(environment.desktopDownloadUrl, '_blank');
    expect(element.querySelector('.download-notice')?.textContent?.trim()).toBe('landing.downloadFallback');
  });
});
