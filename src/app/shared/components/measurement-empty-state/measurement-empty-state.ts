import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Lo que se ve cuando todavía no hay ninguna medición: en vez de ceros que parezcan una lectura real. */
@Component({
  selector: 'app-measurement-empty-state',
  imports: [TranslatePipe],
  template: `<section class="empty" role="status">
    <span class="sticker" aria-hidden="true">{{ 'common.measurements.emptySticker' | translate }}</span>
    <h2>{{ 'common.measurements.emptyTitle' | translate }}</h2>
    <p>{{ 'common.measurements.emptyDescription' | translate }}</p>
  </section>`,
  styleUrl: './measurement-empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementEmptyState {}
