import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { PendingMeasurement } from './pending-measurement';
import { PendingMeasurementRepository } from './pending-measurement.repository';

// Rust la guarda en un archivo JSON de la carpeta de datos de la app (pending_measurements.rs), fuera de la interfaz.
@Injectable()
export class PendingMeasurementTauriRepository extends PendingMeasurementRepository {
  load(): Promise<PendingMeasurement[]> {
    return invoke<PendingMeasurement[]>('load_pending_measurements');
  }

  save(items: PendingMeasurement[]): Promise<void> {
    return invoke('save_pending_measurements', { items });
  }
}
