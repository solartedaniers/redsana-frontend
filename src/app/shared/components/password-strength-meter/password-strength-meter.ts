import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PasswordStrengthEvaluator } from '../../../core/auth/password-strength/password-strength.evaluator';
import { PASSWORD_STRENGTH_CONFIG } from '../../../core/auth/password-strength/password-strength.config';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../icon/icon';

/**
 * Live password strength feedback: one bar per criterion, filled as the user
 * meets them, plus a text level (never color alone). Visual only: it does not
 * block submits, touch validators, or send/store the password anywhere.
 */
@Component({
  selector: 'app-password-strength-meter',
  imports: [TranslatePipe, Icon],
  templateUrl: './password-strength-meter.html',
  styleUrl: './password-strength-meter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordStrengthMeter {
  readonly password = input.required<string | null>();
  /** Lists every criterion as met/pending: used where the rule is enforced (register, reset). */
  readonly showRequirements = input(false);

  private readonly evaluator = new PasswordStrengthEvaluator();

  protected readonly strength = computed(() => this.evaluator.evaluate(this.password() ?? ''));
  protected readonly bars = Array.from({ length: this.evaluator.totalCriteria }, (_, index) => index);
  protected readonly criterionIds = this.evaluator.criterionIds;
  protected readonly criterionParams = { min: PASSWORD_STRENGTH_CONFIG.minLength };
}
