import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { BRAND_ASSETS } from '../../../core/branding/brand-assets';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Mientras una pantalla protegida espera el perfil: "Despertando el servidor…" y, si vence la espera, el fallo con
 reintentar. Usa la misma pantalla que el splash de index.html para que el cambio no se note. */
@Component({
  selector: 'app-session-restore-status',
  imports: [TranslatePipe],
  templateUrl: './session-restore-status.html',
  styleUrl: './session-restore-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--brand-symbol-mask]': 'symbolMask' },
})
export class SessionRestoreStatus {
  protected readonly auth = inject(AuthService);
  protected readonly symbolMask = `url(${BRAND_ASSETS.symbolMask})`;
}
