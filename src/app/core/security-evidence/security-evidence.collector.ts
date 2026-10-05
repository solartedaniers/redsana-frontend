import { Injectable, inject } from '@angular/core';
import { TechnicalEvidence } from '../models/security.model';
import { RouterPortScanGateway } from '../router-port-scan/router-port-scan.gateway';
import { WifiEncryptionGateway } from '../wifi-encryption/wifi-encryption.gateway';

/**
 * Reúne la evidencia técnica de la red que el backend puntúa (70% del puntaje).
 * Solo recolecta: qué vale cada dato lo deciden los analizadores del backend.
 */
@Injectable({ providedIn: 'root' })
export class SecurityEvidenceCollector {
  private readonly wifiGateway = inject(WifiEncryptionGateway);
  private readonly routerPortScanGateway = inject(RouterPortScanGateway);

  readonly isTechnicalAnalysisAvailable = this.wifiGateway.isAvailable || this.routerPortScanGateway.isAvailable;

  async collect(): Promise<TechnicalEvidence> {
    const [wifiEncryptionRaw, routerOpenPorts] = await Promise.all([
      this.wifiGateway.detect(),
      this.routerPortScanGateway.scanOpenPorts(),
    ]);
    return { wifiEncryptionRaw, routerOpenPorts };
  }
}
