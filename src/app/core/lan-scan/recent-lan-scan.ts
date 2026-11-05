import { Injectable } from '@angular/core';
import { LAN_SCAN_CONFIG } from './lan-scan.config';

/** Cuándo terminó el último escaneo de esta sesión de la app; sobrevive a salir y volver a la pantalla. */
@Injectable({ providedIn: 'root' })
export class RecentLanScan {
  private lastScanAt: number | null = null;

  markScanned(): void {
    this.lastScanAt = Date.now();
  }

  isRecent(): boolean {
    return this.lastScanAt !== null && Date.now() - this.lastScanAt < LAN_SCAN_CONFIG.recentScanWindowMs;
  }
}
