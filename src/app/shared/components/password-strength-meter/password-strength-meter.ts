import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PasswordStrengthEvaluator } from '../../../core/auth/password-strength/password-strength.evaluator';
import { PASSWORD_STRENGTH_CONFIG } from '../../../core/auth/password-strength/password-strength.config';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../icon/icon';

/** Medidor en vivo de la contraseña: solo visual, no bloquea envíos ni guarda ni envía nada. */
@Component({
  selector: 'app-password-strength-meter',
  imports: [TranslatePipe, Icon],
  templateUrl: './password-strength-meter.html',
  styleUrl: './password-strength-meter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordStrengthMeter {
  readonly password = input.required<string | null>();
  /** Muestra cada criterio como cumplido o pendiente, donde la regla se exige (registro y restablecimiento). */
  readonly showRequirements = input(false);

  private readonly evaluator = new PasswordStrengthEvaluator();

  protected readonly strength = computed(() => this.evaluator.evaluate(this.password() ?? ''));
  protected readonly bars = Array.from({ length: this.evaluator.totalCriteria }, (_, index) => index);
  protected readonly criterionIds = this.evaluator.criterionIds;
  protected readonly criterionParams = { min: PASSWORD_STRENGTH_CONFIG.minLength };
}
