import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

// El mismo valor que AI_WARMING_UP_DETAIL del backend (app/routers/chat_conversations.py).
const AI_WARMING_UP_DETAIL = 'ai_warming_up';

/** La IA estaba dormida y despertando: no es un fallo, hay que esperar a que esté lista y volver a intentar. */
export class AiWarmingUpError extends Error {
  constructor() {
    super(AI_WARMING_UP_DETAIL);
    this.name = 'AiWarmingUpError';
  }
}

/** Traduce la respuesta "encendiendo" del backend a AiWarmingUpError; cualquier otro error pasa igual. */
export function mapAiWarmingUp<T>() {
  return (source: Observable<T>): Observable<T> =>
    source.pipe(
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof HttpErrorResponse &&
          error.status === HttpStatusCode.ServiceUnavailable &&
          error.error?.detail === AI_WARMING_UP_DETAIL
            ? new AiWarmingUpError()
            : error,
        ),
      ),
    );
}
