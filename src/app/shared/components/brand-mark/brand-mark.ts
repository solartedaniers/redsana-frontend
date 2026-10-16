import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BRAND_ASSETS } from '../../../core/branding/brand-assets';

/** Marca de RedSana: solo el escudo del logo, sin fondo, pintado con el color de marca del tema. Decorativa: el nombre
 va siempre al lado. */
@Component({
  selector: 'app-brand-mark',
  template: `<span class="symbol" aria-hidden="true"></span>`,
  styleUrl: './brand-mark.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--brand-symbol-mask]': 'symbolMask' },
})
export class BrandMark {
  protected readonly symbolMask = `url(${BRAND_ASSETS.symbolMask})`;
}
