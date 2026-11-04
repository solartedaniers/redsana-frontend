import { Injectable, signal } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';

export type RealtimeEventType = 'measurement.created' | 'alert.created' | 'devices.updated' | 'ai.status.changed';

export interface RealtimeEvent {
  readonly type: RealtimeEventType;
  /** null en los eventos para todos, como ai.status.changed. */
  readonly owner_id: string | null;
  readonly data: Record<string, unknown>;
  readonly at: string;
}

/**
 * Lo que el socket deja a la app: si está en vivo y un aviso por cada cambio del usuario. Los repositorios no saben del
 * socket: con isLive en false sondean como siempre y cada aviso solo les pide volver a consultar el REST.
 */
@Injectable({ providedIn: 'root' })
export class LiveUpdates {
  private readonly live = signal(false);
  readonly isLive = this.live.asReadonly();
  private readonly changes = new Subject<RealtimeEventType | 'resync'>();

  setLive(live: boolean): void {
    this.live.set(live);
  }

  /** Un evento del usuario que llegó por el socket. */
  publish(event: RealtimeEvent): void {
    this.changes.next(event.type);
  }

  /** El socket volvió a estar en vivo: lo que pasó mientras no lo estaba se vuelve a pedir por REST. */
  resync(): void {
    this.changes.next('resync');
  }

  /** Emite cada vez que hay que reconsultar lo que depende de type, incluido cada resync. */
  refreshesFor(type: RealtimeEventType): Observable<void> {
    return this.changes.pipe(
      filter((change) => change === type || change === 'resync'),
      map(() => undefined),
    );
  }
}
