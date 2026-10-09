/** Lo único que necesito de cada asset del release. */
export interface ReleaseAsset {
  readonly name: string;
  readonly browser_download_url: string;
}

/** Elige el instalador por el final del nombre; .msi, .sig o .zip nunca coinciden. */
export function selectInstallerAsset(assets: readonly ReleaseAsset[], suffix: string): ReleaseAsset | null {
  const wanted = suffix.toLowerCase();
  return assets.find((asset) => asset.name.toLowerCase().endsWith(wanted)) ?? null;
}
