import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // La landing es la única ruta prerenderizada: es pública e igual para todos.
  { path: '', renderMode: RenderMode.Prerender },
  // El resto va en CSR: son datos privados de cada usuario, no hay nada que indexar ni cachear.
  { path: '**', renderMode: RenderMode.Client },
];
