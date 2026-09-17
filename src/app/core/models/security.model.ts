export interface SecurityQuestion {
  id: string;
  textKey: string;
  weight: number;
}

export type SecurityAnswers = Record<string, boolean>;

export interface SecurityRecommendation {
  id: string;
  titleKey: string;
  descriptionKey: string;
  priority: number;
}

export interface SecurityAssessmentResult {
  score: number;
  recommendations: SecurityRecommendation[];
}
