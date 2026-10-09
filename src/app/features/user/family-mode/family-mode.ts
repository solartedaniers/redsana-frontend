import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FAMILY_DNS } from '../../../core/domain/family-dns';
import { I18nService } from '../../../core/i18n/i18n.service';
import { splitTemplate } from '../../../core/i18n/template-segments';
import { CHAT_TOPIC_QUERY_PARAM, UserStartableChatTopic } from '../../../core/models/security.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { APP_PATHS } from '../../../core/routing/app-paths';

const STEP_KEYS = [
  'user.familyMode.steps.openPanel',
  'user.familyMode.steps.signIn',
  'user.familyMode.steps.findDns',
  'user.familyMode.steps.setDns',
  'user.familyMode.steps.save',
] as const;

// Es una guía y no una automatización: cambiar el DNS por HTTP exigiría un conector por cada router.
// Por eso RedSana nunca pide la contraseña del router.
@Component({
  selector: 'app-family-mode',
  imports: [RouterLink, TranslatePipe, Icon, PageHeader],
  templateUrl: './family-mode.html',
  styleUrl: './family-mode.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyMode {
  protected readonly paths = APP_PATHS;
  private readonly i18n = inject(I18nService);

  protected readonly dns = FAMILY_DNS;
  protected readonly dnsEntries = [
    { labelKey: 'user.familyMode.primaryDns', value: FAMILY_DNS.primary },
    { labelKey: 'user.familyMode.secondaryDns', value: FAMILY_DNS.secondary },
  ] as const;
  /** Último DNS copiado, anunciado en una región en vivo. */
  protected readonly copiedValue = signal<string | null>(null);
  // Parto cada paso en texto y valores para mostrar los DNS como píldoras sin tocar la traducción.
  protected readonly steps = computed(() => {
    const dnsParams = { primary: this.dns.primary, secondary: this.dns.secondary };
    return STEP_KEYS.map((key) => ({ key, segments: splitTemplate(this.i18n.translate(key), dnsParams) }));
  });
  // El asistente recibe estos mismos pasos como contexto; la guía fija queda de respaldo.
  protected readonly assistantQueryParams: Record<string, UserStartableChatTopic> = {
    [CHAT_TOPIC_QUERY_PARAM]: 'family_mode',
  };

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copiedValue.set(value);
    } catch {
      // Portapapeles denegado: el valor sigue a la vista para copiarlo a mano.
      this.copiedValue.set(null);
    }
  }
}
