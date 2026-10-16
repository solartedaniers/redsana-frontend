import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MeasurementSource, NetworkStatus } from '../../../core/models/network.model';
import { networkStatusLabelKey } from '../../../core/domain/network-status-label';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-network-status-light',
  imports: [TranslatePipe],
  templateUrl: './network-status-light.html',
  styleUrl: './network-status-light.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkStatusLight {
  readonly status = input.required<NetworkStatus>();
  readonly source = input<MeasurementSource | undefined>(undefined);
  protected readonly labelKey = computed(() => networkStatusLabelKey(this.status(), this.source()));
}
