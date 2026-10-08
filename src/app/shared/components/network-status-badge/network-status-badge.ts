import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NetworkStatus } from '../../../core/models/network.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * Estado real de la última medición de red como badge. Sin medición (null) o
 * con estado "unknown" -lo que el backend devuelve mientras no hay datos- no
 * muestra nada: antes las pantallas decían "Red saludable" fijo, sin medir.
 */
@Component({
  selector: 'app-network-status-badge',
  imports: [TranslatePipe],
  template: `@if (visibleStatus(); as current) {
    <span class="status-badge" [attr.data-status]="current">{{ 'common.networkStatus.' + current | translate }}</span>
  }`,
  styleUrl: './network-status-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkStatusBadge {
  readonly status = input<NetworkStatus | null>(null);

  protected readonly visibleStatus = computed(() => {
    const status = this.status();
    return status === null || status === 'unknown' ? null : status;
  });
}
