import { Injectable } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { supabaseClient } from '../auth/supabase-client';
import { AvatarStorageGateway } from './avatar-storage.gateway';

/** Bucket público ya creado en Supabase Storage para las fotos de perfil. */
const AVATARS_BUCKET = 'avatars';

@Injectable()
export class SupabaseAvatarStorageGateway extends AvatarStorageGateway {
  uploadAvatar(userId: string, file: File): Observable<string> {
    // Un único objeto por usuario (no "{userId}/{timestamp}"): sube con upsert
    // para no acumular fotos viejas huérfanas en el bucket en cada cambio.
    const extension = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/avatar.${extension}`;

    return from(
      supabaseClient.storage.from(AVATARS_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
    ).pipe(
      switchMap(({ error }) => {
        if (error) {
          return throwError(() => new Error('auth.errors.avatarUploadFailed'));
        }
        const { data } = supabaseClient.storage.from(AVATARS_BUCKET).getPublicUrl(path);
        // Cache-buster: la ruta del objeto es siempre la misma (upsert), así que
        // sin esto el navegador seguiría mostrando la imagen anterior cacheada.
        return from([`${data.publicUrl}?t=${Date.now()}`]);
      })
    );
  }
}
