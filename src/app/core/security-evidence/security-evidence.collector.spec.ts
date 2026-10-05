import { TestBed } from '@angular/core/testing';
import { RouterPortScanGateway } from '../router-port-scan/router-port-scan.gateway';
import { RouterPortScanWebGateway } from '../router-port-scan/router-port-scan-web.gateway';
import { WifiEncryptionGateway } from '../wifi-encryption/wifi-encryption.gateway';
import { WifiEncryptionWebGateway } from '../wifi-encryption/wifi-encryption-web.gateway';
import { SecurityEvidenceCollector } from './security-evidence.collector';

describe('SecurityEvidenceCollector', () => {
  it('junta el cifrado y los puertos medidos por el escritorio', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: WifiEncryptionGateway, useValue: { isAvailable: true, detect: () => Promise.resolve('WPA2-Personal') } },
        { provide: RouterPortScanGateway, useValue: { isAvailable: true, scanOpenPorts: () => Promise.resolve([23]) } },
      ],
    });
    const collector = TestBed.inject(SecurityEvidenceCollector);

    expect(collector.isTechnicalAnalysisAvailable).toBe(true);
    expect(await collector.collect()).toEqual({ wifiEncryptionRaw: 'WPA2-Personal', routerOpenPorts: [23] });
  });

  it('en la web no inventa evidencia: todo queda como no medido', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: WifiEncryptionGateway, useClass: WifiEncryptionWebGateway },
        { provide: RouterPortScanGateway, useClass: RouterPortScanWebGateway },
      ],
    });
    const collector = TestBed.inject(SecurityEvidenceCollector);

    expect(collector.isTechnicalAnalysisAvailable).toBe(false);
    expect(await collector.collect()).toEqual({ wifiEncryptionRaw: null, routerOpenPorts: null });
  });
});
