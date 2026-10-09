import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NetworkStatus } from '../../../core/models/network.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Estado real de la última medición; sin medición o en "unknown" no muestro nada en vez de inventar "Red saludable". */
@Component({
  selector: 'app-network-status-badge',
  imports: [TranslatePipe],
  template: `@if (visibleStatus(); as current) {
    <span class="status-badge" [attr.data-status]="current">{{ 'common.networkStatus.' + current | translate }}</span>
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkStatusBadge {
  readonly status = input<NetworkStatus | null>(null);

  protected readonly visibleStatus = computed(() => {
    const status = this.status();
    return status === null || status === 'unknown' ? null : status;
  });
}
