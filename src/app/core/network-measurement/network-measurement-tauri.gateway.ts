import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { NetworkQualityMeasurement } from '../models/network.model';
import { NetworkMeasurementGateway } from './network-measurement.gateway';

// Rust ya serializa en camelCase, así que aquí no hace falta mapear campos.
@Injectable()
export class NetworkMeasurementTauriGateway extends NetworkMeasurementGateway {
  readonly source = 'native';

  measure(): Promise<NetworkQualityMeasurement> {
    return invoke<NetworkQualityMeasurement>('measure_network_quality');
  }
}
