import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { DEFAULT_PRESENCE_FILTER, PRESENCE_FILTERS, PresenceFilter } from './presence-filter.config';

/** Control segmentado "En línea / Todos": solo elige qué se lista, no toca el escaneo ni la presencia. */
@Component({
  selector: 'app-presence-filter-toggle',
  imports: [TranslatePipe],
  template: `<div class="presence" role="group" [attr.aria-label]="'user.devicesMap.presence.label' | translate">
    @for (option of options; track option) {
      <button type="button" [class.active]="value() === option" [attr.aria-pressed]="value() === option" (click)="value.set(option)">
        {{ 'user.devicesMap.presence.' + option | translate }}
      </button>
    }
  </div>`,
  styleUrl: './presence-filter-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresenceFilterToggle {
  readonly value = model<PresenceFilter>(DEFAULT_PRESENCE_FILTER);
  protected readonly options = PRESENCE_FILTERS;
}
