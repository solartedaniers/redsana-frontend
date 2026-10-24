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
  /** recordedAt: hora en que se tomó (ISO), para lo que llega tarde; el backend la usa para no guardar dos veces un
   * reenvío. Sin ella el backend usa su propia hora. */
  /** sentAt: hora del reloj del equipo al enviar; con ella el backend corrige recordedAt si el reloj está mal puesto. */
  abstract record(
    measurement: NetworkQualityMeasurement,
    source: MeasurementSource,
    networkFingerprint: string | null,
    recordedAt?: string,
    sentAt?: string,
  ): Observable<NetworkMetricSnapshot>;
  abstract getAnomalyStatus(householdId?: string): Observable<AnomalyDetectionStatus>;
}
