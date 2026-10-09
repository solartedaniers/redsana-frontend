import { Observable } from 'rxjs';
import {
  AnomalyDetectionStatus,
  MeasurementSource,
  NetworkMetricSample,
  NetworkMetricSnapshot,
  NetworkQualityMeasurement,
} from '../models/network.model';

/** householdId solo lo pasa el admin para ver la red de otro hogar. */
export abstract class NetworkMetricsRepository {
  abstract getSnapshot(householdId?: string): Observable<NetworkMetricSnapshot>;
  abstract watchSnapshot(householdId?: string): Observable<NetworkMetricSnapshot>;
  abstract getHistory(householdId?: string): Observable<NetworkMetricSample[]>;
  /** Guarda una medición real del usuario autenticado. */
  /** networkFingerprint: hash de la red actual (solo escritorio); null si no se pudo identificar. */
  abstract record(
    measurement: NetworkQualityMeasurement,
    source: MeasurementSource,
    networkFingerprint: string | null
  ): Observable<NetworkMetricSnapshot>;
  abstract getAnomalyStatus(householdId?: string): Observable<AnomalyDetectionStatus>;
}
