import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BRAND_ASSETS } from '../../../core/branding/brand-assets';

/** Marca de RedSana: el escudo dorado del logo dentro del sticker de tinta. Decorativa: el nombre va siempre al lado. */
@Component({
  selector: 'app-brand-mark',
  template: `<img [src]="markUrl" alt="" decoding="async" />`,
  styleUrl: './brand-mark.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMark {
  protected readonly markUrl = BRAND_ASSETS.mark;
}
