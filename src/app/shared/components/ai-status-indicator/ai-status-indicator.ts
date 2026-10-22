import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AiStatusService } from '../../../core/ai-status/ai-status.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AiAvailability } from '../../../core/models/ai.model';

type StickerTone = 'healthy' | 'warning' | 'critical';

// Los mismos tonos de los stickers de estado: sin colores propios.
const TONE_BY_STATUS: Record<AiAvailability, StickerTone> = {
  ready: 'healthy',
  warming_up: 'warning',
  unavailable: 'critical',
};

/** "IA encendiendo… / IA lista / no disponible"; sin sesión no muestra nada. */
@Component({
  selector: 'app-ai-status-indicator',
  imports: [TranslatePipe],
  templateUrl: './ai-status-indicator.html',
  styleUrl: './ai-status-indicator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiStatusIndicator {
  protected readonly aiStatus = inject(AiStatusService);

  protected readonly visibleStatus = computed<AiAvailability | null>(() => {
    const status = this.aiStatus.status();
    return status === 'idle' ? null : status;
  });
  protected readonly hintKey = computed(() => {
    const status = this.visibleStatus();
    if (status === 'unavailable') {
      return `common.aiStatus.reason.${this.aiStatus.unavailableReason()}`;
    }
    return status === 'warming_up' && this.aiStatus.isTakingLong() ? 'common.aiStatus.slowWarmUp' : null;
  });
  protected readonly showSlowNotice = computed(() => this.visibleStatus() === 'warming_up' && this.aiStatus.isTakingLong());
  protected readonly tone = computed(() => {
    const status = this.visibleStatus();
    return status ? TONE_BY_STATUS[status] : null;
  });
}
