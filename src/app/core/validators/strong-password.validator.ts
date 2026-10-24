import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PasswordStrengthEvaluator } from '../auth/password-strength/password-strength.evaluator';

/** Clave del error en el control; su valor lista los criterios que faltan. */
export const STRONG_PASSWORD_ERROR = 'passwordStrength';

// Solo donde se elige una contraseña nueva: en el login dejaría fuera contraseñas viejas.
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
