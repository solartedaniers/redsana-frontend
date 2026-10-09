import { Injectable } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { supabaseClient } from '../auth/supabase-client';
import { AvatarStorageGateway } from './avatar-storage.gateway';

/** Bucket público de Supabase Storage para las fotos de perfil. */
const AVATARS_BUCKET = 'avatars';

@Injectable()
export class SupabaseAvatarStorageGateway extends AvatarStorageGateway {
  uploadAvatar(userId: string, file: File): Observable<string> {
    // Un objeto por usuario con upsert, para no ir acumulando fotos viejas en el bucket.
    const extension = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/avatar.${extension}`;

    return from(
      supabaseClient.storage.from(AVATARS_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
    ).pipe(
      switchMap(({ error }) => {
        if (error) {
          // En pantalla solo va el mensaje genérico; la causa real (p. ej. una política RLS) la dejo en consola.
          console.error('[AvatarStorage] Supabase Storage rechazó la subida', error);
          return throwError(() => new Error('auth.errors.avatarUploadFailed'));
        }
        const { data } = supabaseClient.storage.from(AVATARS_BUCKET).getPublicUrl(path);
        // La ruta es siempre la misma por el upsert: sin este parámetro el navegador mostraría la foto vieja.
        return from([`${data.publicUrl}?t=${Date.now()}`]);
      })
    );
  }
}
