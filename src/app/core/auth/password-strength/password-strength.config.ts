import { MIN_PASSWORD_LENGTH } from '../password-policy';

export type PasswordCriterionId = 'minLength' | 'lowercase' | 'uppercase' | 'digit' | 'symbol';
export type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

/**
 * Single password rule set for the whole app. The meter (login, register,
 * reset) and the strongPasswordValidator (register, reset) both read it, so
 * the bars and the enforced rule can never disagree. Login only shows it.
 */
export const PASSWORD_STRENGTH_CONFIG = {
  minLength: MIN_PASSWORD_LENGTH,
  // Unicode classes: accented letters and Unicode symbols count too.
  patterns: {
    lowercase: /\p{Ll}/u,
    uppercase: /\p{Lu}/u,
    digit: /\p{Nd}/u,
    symbol: /[^\p{L}\p{Nd}\s]/u,
  },
  // Below the minimum length the level never goes past 'weak', whatever else it has.
  requiredCriterion: 'minLength' as PasswordCriterionId,
  // Lowest number of met criteria for each level, from best to worst.
  levelThresholds: [
    { level: 'strong', minMet: 5 },
    { level: 'good', minMet: 4 },
    { level: 'fair', minMet: 3 },
    { level: 'weak', minMet: 0 },
  ] as const satisfies readonly { level: PasswordStrengthLevel; minMet: number }[],
} as const;
