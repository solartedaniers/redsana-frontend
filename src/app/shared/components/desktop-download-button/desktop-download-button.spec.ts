import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { RuntimeEnvironmentService } from '../../../core/runtime/runtime-environment.service';
import { DesktopDownloadButton } from './desktop-download-button';

function render(isDesktop: boolean): HTMLElement {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), { provide: RuntimeEnvironmentService, useValue: { isDesktop } }],
  });
  const fixture = TestBed.createComponent(DesktopDownloadButton);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('DesktopDownloadButton', () => {
  it('en la web enlaza al instalador configurado, con el texto de la landing', () => {
    const link = render(false).querySelector('a.submit-button');

    expect(link?.getAttribute('href')).toBe(environment.desktopDownloadUrl);
    expect(link?.textContent?.trim()).toBe('landing.download');
  });

  it('en la app de escritorio no se muestra', () => {
    expect(render(true).querySelector('a')).toBeNull();
  });
});
