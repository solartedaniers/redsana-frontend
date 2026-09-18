import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { NetworkQualityMeasurement } from '../models/network.model';
import { NetworkMeasurementGateway } from './network-measurement.gateway';

// El comando Rust ya serializa en camelCase (#[serde(rename_all = "camelCase")]),
// por lo que measure() no necesita mapear nombres de campo.
@Injectable()
export class NetworkMeasurementTauriGateway extends NetworkMeasurementGateway {
  measure(): Promise<NetworkQualityMeasurement> {
    return invoke<NetworkQualityMeasurement>('measure_network_quality');
  }
}
