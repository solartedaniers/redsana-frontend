import { NetworkStatus } from './network.model';

export interface PlatformMetrics {
  totalUsers: number;
  monitoredHouseholds: number;
  activeAlerts: number;
  averageSecurityScore: number;
}

export interface MonitoredHousehold {
  id: string;
  ownerName: string;
  label: string;
  status: NetworkStatus;
  securityScore: number;
  lastActivity: string;
}
