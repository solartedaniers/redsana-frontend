import { TestBed } from '@angular/core/testing';
import { BRAND_ASSETS } from '../../../core/branding/brand-assets';
import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  it('usa el símbolo transparente configurado como máscara y es decorativo', () => {
    const fixture = TestBed.createComponent(BrandMark);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--brand-symbol-mask')).toBe(`url(${BRAND_ASSETS.symbolMask})`);
    expect(host.querySelector('.symbol')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('img')).toBeNull();
  });
});
