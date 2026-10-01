import { NetworkQualityMeasurement } from '../models/network.model';

// Misma fórmula que aggregate_samples en src-tauri/src/ping.rs: el modelo de
// anomalías del backend mezcla mediciones web y nativas del mismo usuario, así
// que ambas fuentes deben calcular jitter y pérdida exactamente igual.
export function aggregateLatencySamples(latenciesMs: number[], expectedSamples: number): NetworkQualityMeasurement {
  const received = latenciesMs.length;
  const packetLossPercent = expectedSamples === 0 ? 0 : (100 * (expectedSamples - received)) / expectedSamples;

  if (received === 0) {
    return { latencyMs: 0, jitterMs: 0, packetLossPercent };
  }

  const latencyMs = latenciesMs.reduce((sum, value) => sum + value, 0) / received;

  let jitterMs = 0;
  if (received >= 2) {
    let deltaSum = 0;
    for (let i = 1; i < received; i++) {
      deltaSum += Math.abs(latenciesMs[i] - latenciesMs[i - 1]);
    }
    jitterMs = deltaSum / (received - 1);
  }

  return { latencyMs, jitterMs, packetLossPercent };
}
