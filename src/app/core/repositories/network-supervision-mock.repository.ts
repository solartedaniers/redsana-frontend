import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { NetworkSupervisionRepository } from './network-supervision.repository';
import { MonitoredHousehold } from '../models/admin.model';

const SIMULATED_LATENCY_MS = 300;

const HOUSEHOLDS: MonitoredHousehold[] = [
  {
    id: 'house-1',
    ownerName: 'Familia Torres',
    label: 'Av. Siempre Viva 742',
    status: 'good',
    securityScore: 85,
    lastActivity: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'house-2',
    ownerName: 'Carlos Medina',
    label: 'Calle 10 #45-20',
    status: 'warning',
    securityScore: 58,
    lastActivity: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'house-3',
    ownerName: 'Lucía Fernández',
    label: 'Cra. 7 #120-15',
    status: 'critical',
    securityScore: 32,
    lastActivity: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: 'house-4',
    ownerName: 'Roberto Salinas',
    label: 'Diagonal 22 #8-19',
    status: 'good',
    securityScore: 91,
    lastActivity: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

@Injectable()
export class MockNetworkSupervisionRepository extends NetworkSupervisionRepository {
  getHouseholds(): Observable<MonitoredHousehold[]> {
    return of([...HOUSEHOLDS]).pipe(delay(SIMULATED_LATENCY_MS));
  }
}
