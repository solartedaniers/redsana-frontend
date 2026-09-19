import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppLanguage, I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-language-toggle',
  imports: [TranslatePipe],
  templateUrl: './language-toggle.html',
  styleUrl: './language-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggle {
  protected readonly i18n = inject(I18nService);

  switchTo(lang: AppLanguage): void {
    if (lang !== this.i18n.language()) {
      void this.i18n.load(lang);
    }
  }
}
