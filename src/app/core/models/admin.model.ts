import { NetworkStatus } from './network.model';

export interface PlatformMetrics {
  totalUsers: number;
  monitoredHouseholds: number;
  activeAlerts: number;
  averageSecurityScore: number;
}

export type SecurityScoreSource = 'real' | 'estimated';

export interface MonitoredHousehold {
  id: string;
  ownerName: string;
  label: string;
  status: NetworkStatus;
  securityScore: number;
  securityScoreSource: SecurityScoreSource;
  securityScoreIsPartial: boolean;
  /** Solo si el puntaje reutiliza una medición técnica anterior del escritorio. */
  securityTechnicalMeasuredAt: string | null;
  lastActivity: string;
}
