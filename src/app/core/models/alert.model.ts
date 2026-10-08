export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'outage' | 'prediction' | 'untrusted_device';

export interface NetworkAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  messageKey: string;
  messageParams?: Record<string, string | number>;
  timestamp: string;
  acknowledged: boolean;
}
