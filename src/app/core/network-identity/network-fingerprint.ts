/** SHA-256 en hex de la MAC normalizada, calculado con Web Crypto. */
export async function fingerprintFromMac(mac: string): Promise<string> {
  const normalized = mac.trim().toLowerCase().replaceAll(':', '-');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
