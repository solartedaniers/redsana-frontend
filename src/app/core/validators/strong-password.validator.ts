import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PasswordStrengthEvaluator } from '../auth/password-strength/password-strength.evaluator';

/** Error key set on the control; its value lists the missing criterion ids. */
export const STRONG_PASSWORD_ERROR = 'passwordStrength';

/**
 * Requires every criterion of PASSWORD_STRENGTH_CONFIG (the same rules the
 * strength meter draws). Used where a NEW password is chosen (register,
 * reset); never on login, so older passwords can still sign in. An empty value
 * is left to Validators.required.
 */
export function strongPasswordValidator(evaluator = new PasswordStrengthEvaluator()): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const password = control.value ?? '';
    if (password.length === 0) {
      return null;
    }
    const missing = evaluator.missing(password);
    return missing.length === 0 ? null : { [STRONG_PASSWORD_ERROR]: { missing } };
  };
}
