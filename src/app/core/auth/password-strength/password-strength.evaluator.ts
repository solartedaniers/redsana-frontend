import { PASSWORD_STRENGTH_CONFIG, PasswordCriterionId, PasswordStrengthLevel } from './password-strength.config';

export interface PasswordStrength {
  /** null con la contraseña vacía: todavía no hay nada que calificar. */
  readonly level: PasswordStrengthLevel | null;
  readonly metCount: number;
  readonly totalCriteria: number;
  readonly met: readonly PasswordCriterionId[];
}

type CriterionCheck = (password: string) => boolean;

const { patterns } = PASSWORD_STRENGTH_CONFIG;

/** Califica una contraseña; es puro: no guarda nada ni hace peticiones. */
export class PasswordStrengthEvaluator {
  private readonly criteria: Record<PasswordCriterionId, CriterionCheck> = {
    minLength: (password) => [...password].length >= PASSWORD_STRENGTH_CONFIG.minLength,
    lowercase: (password) => patterns.lowercase.test(password),
    uppercase: (password) => patterns.uppercase.test(password),
    digit: (password) => patterns.digit.test(password),
    symbol: (password) => patterns.symbol.test(password),
  };

  /** Criterios en orden de pantalla (una barra cada uno). */
  readonly criterionIds = Object.keys(this.criteria) as PasswordCriterionId[];
  readonly totalCriteria = this.criterionIds.length;

  evaluate(password: string): PasswordStrength {
    if (password.length === 0) {
      return { level: null, metCount: 0, totalCriteria: this.totalCriteria, met: [] };
    }
    const met = this.criterionIds.filter((id) => this.criteria[id](password));
    return { level: this.levelFor(met), metCount: met.length, totalCriteria: this.totalCriteria, met };
  }

  /** Criterios que aún faltan; vacío cuando los cumple todos. */
  missing(password: string): PasswordCriterionId[] {
    return this.criterionIds.filter((id) => !this.criteria[id](password));
  }

  private levelFor(met: readonly PasswordCriterionId[]): PasswordStrengthLevel {
    if (!met.includes(PASSWORD_STRENGTH_CONFIG.requiredCriterion)) {
      return 'weak';
    }
    return PASSWORD_STRENGTH_CONFIG.levelThresholds.find((threshold) => met.length >= threshold.minMet)!.level;
  }
}
