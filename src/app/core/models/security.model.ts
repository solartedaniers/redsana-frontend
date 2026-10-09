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
  id: string;
  score: number;
  questionnaireScore: number;
  /** null cuando no hubo análisis técnico (p. ej. desde la web): el puntaje es parcial. */
  technicalScore: number | null;
  isPartial: boolean;
  /** Fecha de la medición técnica usada; null si nunca se midió desde el escritorio. */
  technicalMeasuredAt: string | null;
  /** true si se envió sin medir y reutiliza la última medición del escritorio. */
  technicalEvidenceReused: boolean;
  recommendations: SecurityRecommendation[];
  submittedAt: string;
}

/** Cifrado WiFi detectado solo; 'unknown' si falla o fuera de Tauri. No es una pregunta al usuario. */
export type WifiEncryptionStatus = 'secure' | 'weak' | 'unknown';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** true cuando `text` es una clave i18n y no un texto redactado por el modelo. */
  isTranslationKey?: boolean;
  /** Valores para interpolar en la clave i18n (p. ej. los DNS exactos de la guía). */
  translationParams?: Record<string, string>;
}

/** Tema con el que nace la conversación; define el contexto extra del asistente. */
export type ChatTopic = 'assessment_briefing' | 'family_mode';
/** Temas que el usuario abre a mano; el resumen de una evaluación lo crea el backend. */
export type UserStartableChatTopic = 'family_mode';
/** Query param con el que otra pantalla abre el asistente en un tema. */
export const CHAT_TOPIC_QUERY_PARAM = 'topic';

export interface ChatConversationSummary {
  id: string;
  topic: ChatTopic | null;
  /** null hasta el primer mensaje, cuando el backend genera el título. */
  title: string | null;
  updatedAt: string;
}

/** Lo que se midió de la red real; null en un campo significa que aquí no se pudo medir. */
export interface TechnicalEvidence {
  wifiEncryptionRaw: string | null;
  routerOpenPorts: number[] | null;
}

/** reply null: el mensaje no se procesó. noticeKey: aviso fijo que reemplaza o acompaña la respuesta. */
export interface ChatReply {
  reply: string | null;
  noticeKey: string | null;
  noticeParams: Record<string, string> | null;
}

export interface ChatBriefing {
  conversation: ChatConversationSummary;
  messages: ChatMessage[];
}
