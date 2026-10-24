import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NetworkMetricsRepository } from '../repositories/network-metrics.repository';
import { PendingMeasurement } from './pending-measurement';

/** Cómo llega una medición al backend: cada plataforma decide si la guarda cuando no hay conexión. */
export abstract class MeasurementDelivery {
  abstract deliver(item: PendingMeasurement): Promise<void>;
}

/**
 * Web: envío directo, sin cola. La web mide la latencia hasta el propio servidor, así que una medición tomada sin
 * conexión solo dice "no llegué al servidor" (también cuando el servidor está caído o arrancando) y reenviarla después
 * registraría un corte del internet de casa que quizá no existió. Tampoco manda la hora: llega al momento y el backend
 * usa la suya, así un reloj del equipo mal puesto no hace que rechace la medición.
 */
@Injectable()
export class DirectMeasurementDelivery extends MeasurementDelivery {
  private readonly metrics = inject(NetworkMetricsRepository);

  async deliver(item: PendingMeasurement): Promise<void> {
    await firstValueFrom(this.metrics.record(item.measurement, item.source, item.networkFingerprint));
  }
}
