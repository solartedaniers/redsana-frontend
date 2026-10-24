import parity from './network-diagnosis-cases.json';
import { diagnoseNetwork } from './network-diagnosis';

// La huella del archivo la comprueba scripts/diagnosis-parity.test.mjs: es la misma que exige el backend.
const limits = parity.thresholds;

describe('diagnoseNetwork (tabla de paridad con el backend)', () => {
  it.each(parity.cases)('$name', (testCase) => {
    const diagnosis = diagnoseNetwork(
      {
        latencyMs: testCase.latency_ms,
        packetLossPercent: testCase.packet_loss_percent,
        gatewayLatencyMs: testCase.gateway_latency_ms,
        minutesSinceRouterReply: testCase.minutes_since_router_reply,
      },
      {
        latencyWarningMs: limits.latency_warning_ms,
        latencyCriticalMs: limits.latency_critical_ms,
        packetLossWarningPercent: limits.packet_loss_warning_percent,
        packetLossCriticalPercent: limits.packet_loss_critical_percent,
      },
      {
        gatewayLatencyBadMs: limits.gateway_latency_bad_ms,
        gatewayRecentReplyMinutes: limits.gateway_recent_reply_minutes,
      },
    );

    expect(diagnosis).toBe(testCase.expected);
  });
});
