import { Injectable, computed, signal } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';

export type RealtimeEventType = 'measurement.created' | 'alert.created' | 'devices.updated' | 'ai.status.changed';

export interface RealtimeEvent {
  readonly type: RealtimeEventType;
  /** null en los eventos para todos, como ai.status.changed. */
  readonly owner_id: string | null;
  readonly data: Record<string, unknown>;
  readonly at: string;
}

const RESYNC = 'resync';

/**
 * Lo que el socket deja a la app: si está en vivo y un aviso por cada cambio del usuario. Los repositorios no saben del
 * socket: con isLive en false sondean como siempre y cada aviso solo les pide volver a consultar el REST.
 */
@Injectable({ providedIn: 'root' })
export class LiveUpdates {
  private readonly live = signal(false);
  readonly isLive = this.live.asReadonly();
  private readonly visible = signal(true);
  /** Con la pestaña oculta no se sondea: una pestaña escondida no debe mantener despierto al backend en Render. */
  readonly shouldPoll = computed(() => this.visible() && !this.live());
  readonly isVisible = this.visible.asReadonly();
  private readonly changes = new Subject<RealtimeEvent | typeof RESYNC>();

  setLive(live: boolean): void {
    this.live.set(live);
  }

  /** Al volver a la pestaña se pide una vez lo que cambió mientras estaba oculta. */
  setVisible(visible: boolean): void {
    const reappeared = visible && !this.visible();
    this.visible.set(visible);
    if (reappeared) {
      this.resync();
    }
  }

  /** Un evento del usuario que llegó por el socket. */
  publish(event: RealtimeEvent): void {
    this.changes.next(event);
  }

  /** El socket volvió a estar en vivo: lo que pasó mientras no lo estaba se vuelve a pedir por REST. */
  resync(): void {
    this.changes.next(RESYNC);
  }

  /** Emite cada vez que hay que reconsultar lo que depende de type, incluido cada resync. */
  refreshesFor(type: RealtimeEventType): Observable<void> {
    return this.changes.pipe(
      filter((change) => change === RESYNC || change.type === type),
      map(() => undefined),
    );
  }

  /** Los eventos de type con sus datos, para quien los usa directamente en vez de reconsultar. */
  eventsOf(type: RealtimeEventType): Observable<RealtimeEvent> {
    return this.changes.pipe(filter((change): change is RealtimeEvent => change !== RESYNC && change.type === type));
  }

  resyncs(): Observable<void> {
    return this.changes.pipe(
      filter((change) => change === RESYNC),
      map(() => undefined),
    );
  }
}
