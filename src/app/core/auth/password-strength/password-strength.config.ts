import { MIN_PASSWORD_LENGTH } from '../password-policy';

export type PasswordCriterionId = 'minLength' | 'lowercase' | 'uppercase' | 'digit' | 'symbol';
export type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

/**
 * Una sola regla de contraseña para toda la app: el medidor y el validador la leen
 * de aquí, así las barras y lo que se exige nunca se contradicen.
 */
export const PASSWORD_STRENGTH_CONFIG = {
  minLength: MIN_PASSWORD_LENGTH,
  // Uso clases Unicode para que cuenten también las letras con tilde y los símbolos.
  patterns: {
    lowercase: /\p{Ll}/u,
    uppercase: /\p{Lu}/u,
    digit: /\p{Nd}/u,
    symbol: /[^\p{L}\p{Nd}\s]/u,
  },
  // Sin el largo mínimo el nivel nunca pasa de débil, tenga lo que tenga.
  requiredCriterion: 'minLength' as PasswordCriterionId,
  // Mínimo de criterios cumplidos para cada nivel, de mejor a peor.
  levelThresholds: [
    { level: 'strong', minMet: 5 },
    { level: 'good', minMet: 4 },
    { level: 'fair', minMet: 3 },
    { level: 'weak', minMet: 0 },
  ] as const satisfies readonly { level: PasswordStrengthLevel; minMet: number }[],
} as const;
