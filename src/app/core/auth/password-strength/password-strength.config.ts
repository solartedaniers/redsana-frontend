import { MIN_PASSWORD_LENGTH } from '../password-policy';

export type PasswordCriterionId = 'minLength' | 'mixedCase' | 'digit' | 'symbol' | 'generousLength';
export type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

/**
 * Visual-feedback-only password strength rules. They never block a submit
 * and never replace the form validators (those keep using MIN_PASSWORD_LENGTH).
 */
export const PASSWORD_STRENGTH_CONFIG = {
  minLength: MIN_PASSWORD_LENGTH,
  // "Comfortable" length: well past the minimum.
  generousLength: MIN_PASSWORD_LENGTH * 2,
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
    { level: 'good', minMet: 3 },
    { level: 'fair', minMet: 2 },
    { level: 'weak', minMet: 0 },
  ] as const satisfies readonly { level: PasswordStrengthLevel; minMet: number }[],
} as const;
