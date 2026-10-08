import { PasswordStrengthEvaluator } from './password-strength.evaluator';

describe('PasswordStrengthEvaluator', () => {
  const evaluator = new PasswordStrengthEvaluator();

  it('una contraseña vacía no tiene nivel ni criterios cumplidos', () => {
    expect(evaluator.evaluate('')).toEqual({ level: null, metCount: 0, totalCriteria: 5, met: [] });
  });

  it('"Omaira25*" cumple los cinco criterios y es óptima', () => {
    const result = evaluator.evaluate('Omaira25*');
    expect(result.metCount).toBe(5);
    expect(result.level).toBe('strong');
    expect(evaluator.missing('Omaira25*')).toEqual([]);
  });

  it('sin mayúscula o sin símbolo no llega a óptima', () => {
    expect(evaluator.evaluate('omaira25*').level).not.toBe('strong');
    expect(evaluator.missing('omaira25*')).toEqual(['uppercase']);
    expect(evaluator.evaluate('Omaira25').level).not.toBe('strong');
    expect(evaluator.missing('Omaira25')).toEqual(['symbol']);
  });

  it('sin la longitud mínima se queda en débil aunque tenga todo lo demás', () => {
    expect(evaluator.evaluate('Om25*').level).toBe('weak');
    expect(evaluator.missing('Om25*')).toEqual(['minLength']);
  });

  it('los niveles siguen los umbrales de la configuración', () => {
    expect(evaluator.evaluate('abcdefgh').level).toBe('weak');
    expect(evaluator.evaluate('abcdefg1').level).toBe('fair');
    expect(evaluator.evaluate('Abcdefg1').level).toBe('good');
  });

  it('letras con acento y símbolos unicode cuentan: "Ñandú2026€" es óptima', () => {
    expect(evaluator.evaluate('Ñandú2026€').level).toBe('strong');
  });
});
