import { Observable } from 'rxjs';

/**
 * Sube la foto de perfil a almacenamiento de archivos y devuelve su URL
 * pública. Separado en su propia abstracción por el mismo motivo que
 * LanScanGateway/WifiEncryptionGateway: habla con un servicio externo
 * (Supabase Storage), no con la API del backend propio.
 */
export abstract class AvatarStorageGateway {
  abstract uploadAvatar(userId: string, file: File): Observable<string>;
}
