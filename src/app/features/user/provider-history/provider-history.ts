import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

// Pantalla presentacional: el adaptador del ISP alimentará estas métricas
// cuando el backend exponga el historial contractual.
@Component({
  selector: 'app-provider-history',
  imports: [PageHeader, TranslatePipe],
  templateUrl: './provider-history.html',
  styleUrl: './provider-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderHistory {}
