import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NetworkMetricsRepository } from '../repositories/network-metrics.repository';
import { MeasurementDelivery } from './measurement-delivery';
import { PENDING_MEASUREMENTS_CONFIG, PendingMeasurement } from './pending-measurement';
import { PendingMeasurementRepository } from './pending-measurement.repository';

type SendOutcome = 'done' | 'retry-later';

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Escritorio: toda medición se guarda en el equipo y sale en orden, de la más vieja a la más nueva. Sin red o con el
 * backend caído queda guardada con su hora original y sale en un ciclo siguiente; el backend reconoce un reenvío por
 * esa hora. El escritorio mide con ping a internet, así que lo guardado durante un corte es el corte real.
 */
@Injectable()
export class QueuedMeasurementDelivery extends MeasurementDelivery {
  private readonly storage = inject(PendingMeasurementRepository);
  private readonly metrics = inject(NetworkMetricsRepository);
  // Copia en memoria cargada una vez: encolar y enviar trabajan sobre la misma lista y no se pisan.
  private queue: Promise<PendingMeasurement[]> | null = null;
  private draining: Promise<void> | null = null;
  private writing: Promise<void> = Promise.resolve();

  async deliver(item: PendingMeasurement): Promise<void> {
    const queue = await this.loadedQueue();
    queue.push(item);
    discardExpired(queue, Date.parse(item.recordedAt));
    await this.persist(queue);
    await this.flush(item.ownerId);
  }

  /** Un solo vaciado a la vez: si ya hay uno en curso, se espera ese. */
  private flush(ownerId: string): Promise<void> {
    this.draining ??= this.drain(ownerId).finally(() => (this.draining = null));
    return this.draining;
  }

  private async drain(ownerId: string): Promise<void> {
    const queue = await this.loadedQueue();
    for (let sent = 0; sent < PENDING_MEASUREMENTS_CONFIG.flushBatchSize; sent++) {
      const item = queue.find((candidate) => candidate.ownerId === ownerId);
      if (!item) {
        return;
      }
      if (sent > 0) {
        await pause(PENDING_MEASUREMENTS_CONFIG.flushPauseMs);
      }
      if ((await this.send(item)) === 'retry-later') {
        return;
      }
      // Por identidad: mientras se enviaba, el tope pudo descartarla.
      const index = queue.indexOf(item);
      if (index >= 0) {
        queue.splice(index, 1);
      }
      await this.persist(queue);
    }
  }

  private async send(item: PendingMeasurement): Promise<SendOutcome> {
    try {
      // sentAt sale del mismo reloj que recordedAt: el backend solo usa la diferencia y un reloj mal puesto no afecta.
      const sentAt = new Date().toISOString();
      await firstValueFrom(
        this.metrics.record(item.measurement, item.source, item.networkFingerprint, item.recordedAt, sentAt),
      );
      return 'done';
    } catch (error) {
      // 422: el backend nunca la aceptará (hora fuera de rango); se descarta para no trabar la cola.
      if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.UnprocessableEntity) {
        console.warn('Medición pendiente rechazada por el backend; se descarta', item.recordedAt);
        return 'done';
      }
      // Sin red, backend caído, sesión vencida...: sigue en la cola para el siguiente ciclo.
      console.warn('No se pudo enviar la medición; queda guardada en el equipo', error);
      return 'retry-later';
    }
  }

  private loadedQueue(): Promise<PendingMeasurement[]> {
    this.queue ??= this.storage.load().catch((error: unknown) => {
      console.error('No se pudo leer la cola local de mediciones', error);
      return [];
    });
    return this.queue;
  }

  private persist(queue: PendingMeasurement[]): Promise<void> {
    const snapshot = [...queue];
    this.writing = this.writing
      .then(() => this.storage.save(snapshot))
      .catch((error: unknown) => console.error('No se pudo guardar la cola local de mediciones', error));
    return this.writing;
  }
}

/** La cola va de más vieja a más nueva: se descarta desde el principio lo vencido y lo que pase del tope. */
function discardExpired(queue: PendingMeasurement[], nowMs: number): void {
  const firstFresh = queue.findIndex(
    (item) => nowMs - Date.parse(item.recordedAt) <= PENDING_MEASUREMENTS_CONFIG.maxAgeMs,
  );
  queue.splice(0, firstFresh === -1 ? queue.length : firstFresh);
  queue.splice(0, Math.max(0, queue.length - PENDING_MEASUREMENTS_CONFIG.maxItems));
}
