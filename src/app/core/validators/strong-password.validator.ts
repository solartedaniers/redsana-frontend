import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PasswordStrengthEvaluator } from '../auth/password-strength/password-strength.evaluator';

/** Clave del error en el control; su valor lista los criterios que faltan. */
export const STRONG_PASSWORD_ERROR = 'passwordStrength';

/**
 * Exige todos los criterios del medidor, solo donde se elige una contraseña nueva (registro y
 * restablecimiento). En el login no se usa para no dejar fuera contraseñas viejas.
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
