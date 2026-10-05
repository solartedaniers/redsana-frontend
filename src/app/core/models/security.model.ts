export interface SecurityQuestion {
  id: string;
  textKey: string;
}

export type SecurityAnswerValue = 'yes' | 'no' | 'unknown';
export type SecurityAnswers = Record<string, SecurityAnswerValue>;

export interface SecurityRecommendation {
  id: string;
  titleKey: string;
  descriptionKey: string;
  priority: number;
}

export interface SecurityAssessmentResult {
  score: number;
  questionnaireScore: number;
  /** null cuando no hubo análisis técnico (p. ej. desde la web): el puntaje es parcial. */
  technicalScore: number | null;
  isPartial: boolean;
  recommendations: SecurityRecommendation[];
  submittedAt: string;
}

/** Cifrado WiFi auto-detectado (Módulo 1, get_wifi_encryption); 'unknown' cuando
 * la detección falla o corre fuera de Tauri, no cuenta como pregunta al usuario. */
export type WifiEncryptionStatus = 'secure' | 'weak' | 'unknown';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** true cuando `text` es una i18n key (fallo de red) en vez de la respuesta ya traducida por Groq. */
  isErrorKey?: boolean;
}

export interface ChatConversationSummary {
  id: string;
  /** null hasta el primer mensaje (el backend autogenera el título); ver historial. */
  title: string | null;
  updatedAt: string;
}

/** Lo que la app midió de la red real; null en un campo = no se pudo medir aquí. */
export interface TechnicalEvidence {
  wifiEncryptionRaw: string | null;
  routerOpenPorts: number[] | null;
}
