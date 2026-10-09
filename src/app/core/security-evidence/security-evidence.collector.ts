import { Injectable, inject } from '@angular/core';
import { TechnicalEvidence } from '../models/security.model';
import { RouterPortScanGateway } from '../router-port-scan/router-port-scan.gateway';
import { WifiEncryptionGateway } from '../wifi-encryption/wifi-encryption.gateway';

/** Junta la evidencia técnica que puntúa el backend (70 %); solo recolecta, no califica. */
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
