import { formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { NetworkDiagnosis } from '../../../core/models/network.model';

const LATENCY_DIGITS_INFO = '1.0-1';
const KEY_PREFIX = 'user.dashboard.diagnosis';

/** Diagnóstico router / proveedor que calcula el backend; aquí solo se elige el texto. */
@Component({
  selector: 'app-network-diagnosis-panel',
  imports: [TranslatePipe],
  templateUrl: './network-diagnosis-panel.html',
  styleUrl: './network-diagnosis-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-diagnosis]': 'diagnosis()' },
})
export class NetworkDiagnosisPanel {
  private readonly locale = inject(LOCALE_ID);

  readonly diagnosis = input.required<NetworkDiagnosis>();
  readonly gatewayLatencyMs = input.required<number>();
  readonly possibleBusyDevice = input(false);

  protected readonly verdictKey = computed(() => `${KEY_PREFIX}.${this.diagnosis()}.verdict`);
  // Con todo bien no hace falta hablar de reiniciar el router.
  protected readonly restartKey = computed(() =>
    this.diagnosis() === 'ok' ? null : `${KEY_PREFIX}.${this.diagnosis()}.restart`,
  );
  protected readonly latency = computed(() => formatNumber(this.gatewayLatencyMs(), this.locale, LATENCY_DIGITS_INFO));
}
