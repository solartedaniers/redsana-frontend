import { Observable } from 'rxjs';
import { NetworkMetricSample, NetworkMetricSnapshot, NetworkQualityMeasurement } from '../models/network.model';

/**
 * householdId es opcional: el usuario estándar lo omite (ve su propia red),
 * el admin lo pasa para inspeccionar la red de un hogar específico.
 */
export abstract class NetworkMetricsRepository {
  abstract getSnapshot(householdId?: string): Observable<NetworkMetricSnapshot>;
  abstract watchSnapshot(householdId?: string): Observable<NetworkMetricSnapshot>;
  abstract getHistory(householdId?: string): Observable<NetworkMetricSample[]>;
  /** Persiste una medición real propia del usuario autenticado. */
  abstract record(measurement: NetworkQualityMeasurement): Observable<NetworkMetricSnapshot>;
}
