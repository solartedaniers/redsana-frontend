import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
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
    return this.http.get<BackendAiStatus>(`${this.baseUrl}/status`).pipe(
      map((response) => response.status),
      catchError(readyWithoutStatusEndpoints)
    );
  }

  warmUp(): Observable<AiAvailability> {
    return this.http.post<BackendAiStatus>(`${this.baseUrl}/warm-up`, null).pipe(
      map((response) => response.status),
      catchError(readyWithoutStatusEndpoints)
    );
  }
}

/** Un backend sin estos endpoints es uno anterior, con la IA en su propio proceso: siempre lista. Así publicar el
 frontend antes que el backend no deja el chat bloqueado. */
function readyWithoutStatusEndpoints(error: unknown): Observable<AiAvailability> {
  if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound) {
    return of('ready');
  }
  return throwError(() => error);
}
