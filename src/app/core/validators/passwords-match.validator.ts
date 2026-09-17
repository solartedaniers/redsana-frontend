import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Compartido entre registro y cambio de contraseña: mismas dos casillas,
// mismo criterio de coincidencia.
export function passwordsMatchValidator(
  passwordControlName: string,
  confirmControlName: string
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordControlName)?.value;
    const confirm = group.get(confirmControlName)?.value;
    return password === confirm ? null : { passwordsMismatch: true };
  };
}
