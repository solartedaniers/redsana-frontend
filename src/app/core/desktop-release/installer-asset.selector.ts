/** Subset of a GitHub release asset that the app needs. */
export interface ReleaseAsset {
  readonly name: string;
  readonly browser_download_url: string;
}

/** Picks the installer asset by name suffix; .msi, .sig, .zip, etc. never match "-setup.exe". */
export function selectInstallerAsset(assets: readonly ReleaseAsset[], suffix: string): ReleaseAsset | null {
  const wanted = suffix.toLowerCase();
  return assets.find((asset) => asset.name.toLowerCase().endsWith(wanted)) ?? null;
}
