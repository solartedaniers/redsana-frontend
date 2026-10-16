import { MeasurementSource, NetworkStatus } from '../models/network.model';

// La web mide peticiones HTTPS hasta el servidor, no la red de la casa: ahí digo "latencia al servidor" y no "Red crítica".
const isServerLatency = (source?: MeasurementSource): boolean => source === 'web';

export function networkStatusLabelKey(status: NetworkStatus, source?: MeasurementSource): string {
  return `common.${isServerLatency(source) ? 'serverLatencyStatus' : 'networkStatus'}.${status}`;
}

export function latencyLabelKey(source?: MeasurementSource): string {
  return isServerLatency(source) ? 'user.dashboard.serverLatency' : 'user.dashboard.latency';
}
