import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FAMILY_DNS } from '../../../core/domain/family-dns';
import { CHAT_TOPIC_QUERY_PARAM, UserStartableChatTopic } from '../../../core/models/security.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
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
  imports: [RouterLink, TranslatePipe, PageHeader],
  templateUrl: './family-mode.html',
  styleUrl: './family-mode.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyMode {
  protected readonly dns = FAMILY_DNS;
  protected readonly stepKeys = STEP_KEYS;
  // El asistente recibe los DNS y estos mismos pasos como contexto; la guía
  // fija de esta pantalla se queda como respaldo.
  protected readonly assistantQueryParams: Record<string, UserStartableChatTopic> = {
    [CHAT_TOPIC_QUERY_PARAM]: 'family_mode',
  };
}
