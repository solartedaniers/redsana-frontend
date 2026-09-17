import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NetworkAlert } from '../../../core/models/alert.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-alert-item',
  imports: [TranslatePipe, DatePipe, Icon],
  templateUrl: './alert-item.html',
  styleUrl: './alert-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertItem {
  readonly alert = input.required<NetworkAlert>();
  readonly acknowledge = output<string>();
}
