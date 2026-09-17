import {
  SecurityAnswers,
  SecurityAssessmentResult,
  SecurityQuestion,
  SecurityRecommendation,
} from '../models/security.model';

// Un backend real probablemente calcule esto server-side, pero se aísla en
// una función pura para poder testearla sin levantar HTTP ni repositorios.
const RECOMMENDATIONS_BY_QUESTION: Record<string, SecurityRecommendation> = {
  'default-password': {
    id: 'change-default-password',
    titleKey: 'user.securityAssistant.recommendations.changeDefaultPassword.title',
    descriptionKey: 'user.securityAssistant.recommendations.changeDefaultPassword.description',
    priority: 1,
  },
  'firmware-updated': {
    id: 'update-firmware',
    titleKey: 'user.securityAssistant.recommendations.updateFirmware.title',
    descriptionKey: 'user.securityAssistant.recommendations.updateFirmware.description',
    priority: 2,
  },
  'wpa3-enabled': {
    id: 'enable-wpa3',
    titleKey: 'user.securityAssistant.recommendations.enableWpa3.title',
    descriptionKey: 'user.securityAssistant.recommendations.enableWpa3.description',
    priority: 3,
  },
  'guest-network': {
    id: 'enable-guest-network',
    titleKey: 'user.securityAssistant.recommendations.enableGuestNetwork.title',
    descriptionKey: 'user.securityAssistant.recommendations.enableGuestNetwork.description',
    priority: 4,
  },
  'remote-management-off': {
    id: 'disable-remote-management',
    titleKey: 'user.securityAssistant.recommendations.disableRemoteManagement.title',
    descriptionKey: 'user.securityAssistant.recommendations.disableRemoteManagement.description',
    priority: 5,
  },
};

export function computeSecurityAssessment(
  questions: SecurityQuestion[],
  answers: SecurityAnswers
): SecurityAssessmentResult {
  const totalWeight = questions.reduce((sum, question) => sum + question.weight, 0);
  const earnedWeight = questions.reduce(
    (sum, question) => sum + (answers[question.id] ? question.weight : 0),
    0
  );
  const score = totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);

  const recommendations = questions
    .filter((question) => !answers[question.id] && RECOMMENDATIONS_BY_QUESTION[question.id])
    .map((question) => RECOMMENDATIONS_BY_QUESTION[question.id])
    .sort((a, b) => a.priority - b.priority);

  return { score, recommendations };
}

export type SecurityScoreBand = 'good' | 'warning' | 'critical';

// Mismos umbrales para cualquier lugar que pinte el puntaje de seguridad
// (asistente, supervisión de admin) - una sola fuente de verdad.
export function getSecurityScoreBand(score: number): SecurityScoreBand {
  if (score >= 80) {
    return 'good';
  }
  if (score >= 50) {
    return 'warning';
  }
  return 'critical';
}
