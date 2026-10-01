import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Única ruta prerenderizada (SSG): la landing es pública, igual para todos y
  // se beneficia de indexación y primer pintado inmediato.
  { path: '', renderMode: RenderMode.Prerender },
  // Dashboard, admin y auth quedan en CSR: sus datos son privados por usuario
  // y dependen de la sesión, no hay nada que indexar ni que cachear entre
  // usuarios, así que ni SSR ni ISR aportan algo aquí.
  { path: '**', renderMode: RenderMode.Client },
];
