import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DeviceKind, inferDeviceKind } from '../../../../core/domain/device-kind';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { DeviceTrust, NetworkDevice } from '../../../../core/models/device.model';
import { Icon } from '../../../../shared/components/icon/icon';

const DEVICE_KIND_ICON: Record<DeviceKind, 'phone' | 'computer' | 'devices'> = {
  phone: 'phone',
  computer: 'computer',
  unknown: 'devices',
};

const TRUST_TONE: Record<DeviceTrust, 'healthy' | 'warning' | 'critical'> = {
  trusted: 'healthy',
  unknown: 'warning',
  blocked: 'critical',
};

/** Muestra un dispositivo y pide los cambios de confianza al mapa, que es quien los guarda. */
@Component({
  selector: 'app-device-card',
  imports: [DatePipe, TranslatePipe, Icon],
  templateUrl: './device-card.html',
  styleUrl: './device-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceCard {
  readonly device = input.required<NetworkDevice>();
  readonly trustChange = output<DeviceTrust>();

  /** "Más info" es estado de esta tarjeta, no del mapa. */
  protected readonly isExpanded = signal(false);
  protected readonly kindIcon = computed(() => DEVICE_KIND_ICON[inferDeviceKind(this.device().macAddress)]);
  protected readonly trustTone = computed(() => TRUST_TONE[this.device().trust]);
  protected readonly kindLabelKey = computed(() => `user.devicesMap.kind.${inferDeviceKind(this.device().macAddress)}`);
}
