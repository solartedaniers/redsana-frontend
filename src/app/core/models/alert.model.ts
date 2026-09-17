export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'outage' | 'prediction';

export interface NetworkAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  messageKey: string;
  messageParams?: Record<string, string | number>;
  timestamp: string;
  acknowledged: boolean;
}
