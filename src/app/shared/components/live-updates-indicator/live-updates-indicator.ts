import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LiveUpdates } from '../../../core/realtime/live-updates';

/** "En vivo" con el socket abierto; "Actualizando" mientras la pantalla sondea el servidor. */
@Component({
  selector: 'app-live-updates-indicator',
  imports: [TranslatePipe],
  templateUrl: './live-updates-indicator.html',
  styleUrl: './live-updates-indicator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveUpdatesIndicator {
  private readonly liveUpdates = inject(LiveUpdates);

  protected readonly mode = computed(() => (this.liveUpdates.isLive() ? 'live' : 'polling'));
}
