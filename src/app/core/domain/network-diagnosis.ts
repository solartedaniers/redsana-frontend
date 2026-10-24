import { NetworkDiagnosis, NetworkStatus } from '../models/network.model';
import { NetworkStatusThresholds, RouterDiagnosisLimits } from '../network-thresholds/network-thresholds.config';

/** Internet caído: se perdieron todos los pings de la medición (INTERNET_DOWN_LOSS_PERCENT del backend). */
const INTERNET_DOWN_LOSS_PERCENT = 100;
const INTERNET_DEGRADED: ReadonlySet<NetworkStatus> = new Set(['warning', 'critical']);

export interface DiagnosisInput {
  readonly latencyMs: number;
  readonly packetLossPercent: number;
  readonly gatewayLatencyMs: number | null;
  /** Minutos desde la última medición en que el router respondió; null si nunca respondió. */
  readonly minutesSinceRouterReply: number | null;
}

/**
 * Réplica exacta de compute_network_status y NetworkDiagnosisPolicy.diagnose del backend, para que el escritorio
 * diagnostique sin conexión con su última medición. network-diagnosis-cases.json es la tabla de paridad que prueban
 * los dos repositorios.
 */
export function diagnoseNetwork(
  input: DiagnosisInput,
  thresholds: NetworkStatusThresholds,
  limits: RouterDiagnosisLimits,
): NetworkDiagnosis | null {
  if (input.gatewayLatencyMs === null) {
    // Un router que nunca responde al ping puede tenerlo bloqueado: sin respuestas recientes no se acusa.
    const internetDown = input.packetLossPercent >= INTERNET_DOWN_LOSS_PERCENT;
    const repliedRecently =
      input.minutesSinceRouterReply !== null && input.minutesSinceRouterReply <= limits.gatewayRecentReplyMinutes;
    return internetDown && repliedRecently ? 'router_unreachable' : null;
  }
  if (input.gatewayLatencyMs >= limits.gatewayLatencyBadMs) {
    return 'router';
  }
  return INTERNET_DEGRADED.has(networkStatus(input.latencyMs, input.packetLossPercent, thresholds)) ? 'provider' : 'ok';
}

function networkStatus(
  latencyMs: number,
  packetLossPercent: number,
  thresholds: NetworkStatusThresholds,
): NetworkStatus {
  if (latencyMs >= thresholds.latencyCriticalMs || packetLossPercent >= thresholds.packetLossCriticalPercent) {
    return 'critical';
  }
  if (latencyMs >= thresholds.latencyWarningMs || packetLossPercent >= thresholds.packetLossWarningPercent) {
    return 'warning';
  }
  return 'good';
}
