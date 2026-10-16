import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AiAvailability } from '../models/ai.model';
import { AiStatusRepository } from './ai-status.repository';

interface BackendAiStatus {
  status: AiAvailability;
}

@Injectable()
export class AiStatusHttpRepository extends AiStatusRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/ai`;

  getStatus(): Observable<AiAvailability> {
    return this.http.get<BackendAiStatus>(`${this.baseUrl}/status`).pipe(map((response) => response.status));
  }

  warmUp(): Observable<AiAvailability> {
    return this.http.post<BackendAiStatus>(`${this.baseUrl}/warm-up`, null).pipe(map((response) => response.status));
  }
}
