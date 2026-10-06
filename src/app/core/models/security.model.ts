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
  /** Fecha de la medición técnica usada (null si nunca se midió desde el escritorio). */
  technicalMeasuredAt: string | null;
  /** true si la evaluación se envió sin medir (p. ej. desde la web) y reutiliza la última medición del escritorio. */
  technicalEvidenceReused: boolean;
  recommendations: SecurityRecommendation[];
  submittedAt: string;
}

/** Cifrado WiFi auto-detectado (Módulo 1, get_wifi_encryption); 'unknown' cuando
 * la detección falla o corre fuera de Tauri, no cuenta como pregunta al usuario. */
export type WifiEncryptionStatus = 'secure' | 'weak' | 'unknown';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** true cuando `text` es una clave i18n (error, aviso o saludo fijo) y no texto ya redactado por el modelo. */
  isTranslationKey?: boolean;
  /** Valores para interpolar en la clave i18n (p. ej. los DNS exactos de la guía). */
  translationParams?: Record<string, string>;
}

/** Tema con el que nace una conversación (define el contexto extra del asistente). */
export type ChatTopic = 'assessment_briefing' | 'family_mode';
/** Temas que el usuario puede abrir a mano; el resumen de una evaluación lo crea el backend. */
export type UserStartableChatTopic = 'family_mode';
/** Query param con el que otra pantalla abre el asistente en un tema (p. ej. modo familiar). */
export const CHAT_TOPIC_QUERY_PARAM = 'topic';

export interface ChatConversationSummary {
  id: string;
  topic: ChatTopic | null;
  /** null hasta el primer mensaje (el backend autogenera el título); ver historial. */
  title: string | null;
  updatedAt: string;
}

/** Lo que la app midió de la red real; null en un campo = no se pudo medir aquí. */
export interface TechnicalEvidence {
  wifiEncryptionRaw: string | null;
  routerOpenPorts: number[] | null;
}

/** reply null = el mensaje no se procesó; noticeKey = aviso fijo que reemplaza o acompaña la respuesta. */
export interface ChatReply {
  reply: string | null;
  noticeKey: string | null;
  noticeParams: Record<string, string> | null;
}

export interface ChatBriefing {
  conversation: ChatConversationSummary;
  messages: ChatMessage[];
}
