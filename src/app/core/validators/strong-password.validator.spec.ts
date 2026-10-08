import { FormControl } from '@angular/forms';
import { STRONG_PASSWORD_ERROR, strongPasswordValidator } from './strong-password.validator';

describe('strongPasswordValidator', () => {
  const validate = (value: string) => new FormControl(value, strongPasswordValidator()).errors;

  it('acepta una contraseña que cumple los cinco criterios', () => {
    expect(validate('Omaira25*')).toBeNull();
  });

  it('rechaza indicando solo los criterios que faltan, sin repetir la contraseña', () => {
    const errors = validate('omaira25');
    expect(errors).toEqual({ [STRONG_PASSWORD_ERROR]: { missing: ['uppercase', 'symbol'] } });
    expect(JSON.stringify(errors)).not.toContain('omaira25');
  });

  it('deja el campo vacío a Validators.required', () => {
    expect(validate('')).toBeNull();
  });
});
