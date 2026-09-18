import { NetworkQualityMeasurement } from '../models/network.model';

/**
 * Fuente de la medición real de red. Hoy la resuelve el comando Tauri
 * measure_network_quality; separado en su propia abstracción porque, a
 * diferencia de NetworkMetricsRepository (que lee/escribe el backend),
 * esto habla con el sistema operativo, no con la API.
 */
export abstract class NetworkMeasurementGateway {
  abstract measure(): Promise<NetworkQualityMeasurement>;
}
