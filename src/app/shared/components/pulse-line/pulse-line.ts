import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Decorative ECG trace with a glowing playhead that sweeps across it on the
 * shared heartbeat rhythm. Purely ornamental (aria-hidden): it never stands
 * for real data. The playhead moves with transform only.
 */
@Component({
  selector: 'app-pulse-line',
  template: `<svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path class="baseline" d="M0 34H400" />
      <path
        class="trace"
        d="M0 34h70l8-6 8 6h20l6 10 10-38 10 44 7-16h56l8-6 8 6h20l6 10 10-38 10 44 7-16h56l8-6 8 6h20l6 10 10-38 10 44 7-16h18"
      />
    </svg>
    <span class="playhead"></span>`,
  styleUrl: './pulse-line.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PulseLine {}
