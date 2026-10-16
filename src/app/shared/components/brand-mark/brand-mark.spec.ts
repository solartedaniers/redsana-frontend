import { TestBed } from '@angular/core/testing';
import { BRAND_ASSETS } from '../../../core/branding/brand-assets';
import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  it('muestra el logo desde el asset configurado y es decorativo', () => {
    const fixture = TestBed.createComponent(BrandMark);
    fixture.detectChanges();

    const image = (fixture.nativeElement as HTMLElement).querySelector('img')!;
    expect(image.getAttribute('src')).toBe(BRAND_ASSETS.mark);
    expect(image.getAttribute('alt')).toBe('');
  });
});
