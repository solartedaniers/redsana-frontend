import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NetworkStatus } from '../../../core/models/network.model';
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
}
