import { ChangeDetectionStrategy, Component } from '@angular/core';

/** RedSana mark: a single heartbeat drawn in fluorescent ink on an ink block. */
@Component({
  selector: 'app-brand-mark',
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path class="trace" d="M2 13h5l2-5 3 10 2.5-7 1.5 2H22" />
  </svg>`,
  styleUrl: './brand-mark.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMark {}
