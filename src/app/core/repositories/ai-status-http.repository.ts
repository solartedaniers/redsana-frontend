import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AiStatusReport } from '../models/ai.model';
import { AiStatusRepository } from './ai-status.repository';

@Injectable()
export class AiStatusHttpRepository extends AiStatusRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/ai`;

  getStatus(): Observable<AiStatusReport> {
    return this.http.get<AiStatusReport>(`${this.baseUrl}/status`).pipe(catchError(readyWithoutStatusEndpoints));
  }

  warmUp(): Observable<AiStatusReport> {
    return this.http
      .post<AiStatusReport>(`${this.baseUrl}/warm-up`, null)
      .pipe(catchError(readyWithoutStatusEndpoints));
  }
}

/** Un backend sin estos endpoints es uno anterior, con la IA en su propio proceso: siempre lista. Así publicar el
 frontend antes que el backend no deja el chat bloqueado. */
function readyWithoutStatusEndpoints(error: unknown): Observable<AiStatusReport> {
  if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound) {
    return of({ status: 'ready' });
  }
  return throwError(() => error);
}
