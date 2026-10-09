import { MeasurementSource, NetworkQualityMeasurement } from '../models/network.model';

/** Fuente de la medición real de red; va aparte porque habla con el sistema operativo, no con la API. */
export abstract class NetworkMeasurementGateway {
  /** Etiqueta con la que se guarda cada medición de esta implementación. */
  abstract readonly source: MeasurementSource;

  abstract measure(): Promise<NetworkQualityMeasurement>;
}
