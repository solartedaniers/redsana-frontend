export interface SessionRestoreConfig {
  /** Espera total por el perfil (/api/users/me) antes de mostrar el fallo; mayor que un arranque en frío del backend en
   * Render (~70 s medidos). */
  readonly profileTimeoutMs: number;
  /** Pausa entre intentos mientras el backend responde con error porque sigue despertando. */
  readonly retryDelayMs: number;
}

export const SESSION_RESTORE_CONFIG: SessionRestoreConfig = {
  profileTimeoutMs: 120_000,
  retryDelayMs: 3_000,
};
