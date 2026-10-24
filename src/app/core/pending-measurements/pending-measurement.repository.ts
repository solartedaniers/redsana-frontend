import { PendingMeasurement } from './pending-measurement';

/** Dónde vive la cola en el equipo; cada plataforma usa su mecanismo y nadie más sabe cuál es. */
export abstract class PendingMeasurementRepository {
  abstract load(): Promise<PendingMeasurement[]>;
  abstract save(items: PendingMeasurement[]): Promise<void>;
}
