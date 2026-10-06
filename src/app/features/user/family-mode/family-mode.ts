import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FAMILY_DNS } from '../../../core/domain/family-dns';
import { I18nService } from '../../../core/i18n/i18n.service';
import { splitTemplate } from '../../../core/i18n/template-segments';
import { CHAT_TOPIC_QUERY_PARAM, UserStartableChatTopic } from '../../../core/models/security.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';

const STEP_KEYS = [
  'user.familyMode.steps.openPanel',
  'user.familyMode.steps.signIn',
  'user.familyMode.steps.findDns',
  'user.familyMode.steps.setDns',
  'user.familyMode.steps.save',
] as const;

// Guía y no automatización: cambiar el DNS por HTTP exigiría un conector por
// marca/firmware de router (login cifrado, tokens CSRF, menús distintos) y
// fallaría sin aviso en la mayoría. Por eso RedSana nunca pide la contraseña
// del router: el usuario hace el cambio en el panel de su propio router.
@Component({
  selector: 'app-family-mode',
  imports: [RouterLink, TranslatePipe, Icon, PageHeader],
  templateUrl: './family-mode.html',
  styleUrl: './family-mode.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyMode {
  private readonly i18n = inject(I18nService);

  protected readonly dns = FAMILY_DNS;
  // Cada paso en trozos de texto y valores: los DNS del paso 4 se muestran como
  // chips sin tocar el texto traducido (se recalcula al cambiar de idioma).
  protected readonly steps = computed(() => {
    const dnsParams = { primary: this.dns.primary, secondary: this.dns.secondary };
    return STEP_KEYS.map((key) => ({ key, segments: splitTemplate(this.i18n.translate(key), dnsParams) }));
  });
  // El asistente recibe los DNS y estos mismos pasos como contexto; la guía
  // fija de esta pantalla se queda como respaldo.
  protected readonly assistantQueryParams: Record<string, UserStartableChatTopic> = {
    [CHAT_TOPIC_QUERY_PARAM]: 'family_mode',
  };
}
