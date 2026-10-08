import { MIN_PASSWORD_LENGTH } from '../password-policy';
import { PasswordStrengthEvaluator } from './password-strength.evaluator';

describe('PasswordStrengthEvaluator', () => {
  const evaluator = new PasswordStrengthEvaluator();

  it('una contraseña vacía no tiene nivel ni criterios cumplidos', () => {
    expect(evaluator.evaluate('')).toEqual({ level: null, metCount: 0, totalCriteria: 5, met: [] });
  });

  it('sin la longitud mínima se queda en débil aunque tenga mayúsculas, números y símbolos', () => {
    const short = 'Ab1!'.slice(0, MIN_PASSWORD_LENGTH - 1);
    const result = evaluator.evaluate(short);
    expect(result.level).toBe('weak');
    expect(result.met).toEqual(['mixedCase', 'digit', 'symbol']);
  });

  it('sube de nivel a medida que cumple criterios', () => {
    expect(evaluator.evaluate('abcdefgh').level).toBe('weak');
    expect(evaluator.evaluate('abcdefg1').level).toBe('fair');
    expect(evaluator.evaluate('Abcdefg1').level).toBe('good');
    expect(evaluator.evaluate('Abcdef1!').level).toBe('good');
    expect(evaluator.evaluate('Abcdefgh1!abcdef').level).toBe('strong');
  });

  it('cuenta letras con acento y símbolos unicode como cualquier otro carácter', () => {
    expect(evaluator.evaluate('Ñandú2026€xyz').met).toEqual(['minLength', 'mixedCase', 'digit', 'symbol']);
  });
});
