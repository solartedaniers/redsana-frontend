export interface LanScanConfig {
  /** Al entrar a Dispositivos no se vuelve a barrer la red si hubo un escaneo hace menos de esto. El botón siempre
   * escanea. */
  readonly recentScanWindowMs: number;
}

export const LAN_SCAN_CONFIG: LanScanConfig = {
  recentScanWindowMs: 120_000,
};
