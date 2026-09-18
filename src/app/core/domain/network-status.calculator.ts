import { NetworkStatus } from '../models/network.model';

const LATENCY_WARNING_MS = 80;
const LATENCY_CRITICAL_MS = 150;
const PACKET_LOSS_WARNING_PERCENT = 1;
const PACKET_LOSS_CRITICAL_PERCENT = 5;

/**
 * Única función que decide el color del semáforo a partir de las métricas
 * crudas, para no repetir los umbrales en el dashboard, la supervisión de
 * admin y cualquier widget futuro que muestre el estado de una red.
 *
 * Espejo intencional de `compute_network_status` en el backend
 * (app/domain/network_status.py): no hay código compartido entre Angular y
 * Python, así que si cambian estos umbrales hay que sincronizarlos a mano allá.
 */
export function computeNetworkStatus(latencyMs: number, packetLossPercent: number): NetworkStatus {
  if (latencyMs >= LATENCY_CRITICAL_MS || packetLossPercent >= PACKET_LOSS_CRITICAL_PERCENT) {
    return 'critical';
  }
  if (latencyMs >= LATENCY_WARNING_MS || packetLossPercent >= PACKET_LOSS_WARNING_PERCENT) {
    return 'warning';
  }
  return 'good';
}
