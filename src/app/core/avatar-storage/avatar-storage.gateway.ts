import { Observable } from 'rxjs';

/** Sube la foto de perfil y devuelve su URL pública; va aparte porque habla con Supabase Storage, no con el backend. */
export abstract class AvatarStorageGateway {
  abstract uploadAvatar(userId: string, file: File): Observable<string>;
}
