import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MonitoredHousehold } from '../models/admin.model';
import { NetworkStatus } from '../models/network.model';
import { NetworkSupervisionRepository } from './network-supervision.repository';

interface BackendHousehold {
  id: string;
  owner_name: string;
  label: string;
  status: NetworkStatus;
  security_score: number;
  last_activity: string;
}

@Injectable()
export class NetworkSupervisionHttpRepository extends NetworkSupervisionRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/admin/households`;

  getHouseholds(): Observable<MonitoredHousehold[]> {
    return this.http
      .get<BackendHousehold[]>(this.baseUrl)
      .pipe(map((households) => households.map((household) => this.toHousehold(household))));
  }

  private toHousehold(household: BackendHousehold): MonitoredHousehold {
    return {
      id: household.id,
      ownerName: household.owner_name,
      label: household.label,
      status: household.status,
      securityScore: household.security_score,
      lastActivity: household.last_activity,
    };
  }
}
