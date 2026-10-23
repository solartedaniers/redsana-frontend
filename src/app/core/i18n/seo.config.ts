/** Valores fijos de las etiquetas para buscadores y redes: los textos salen de i18n y el dominio de WEB_APP_URL. */
export const SEO_CONFIG = {
  // Solo las rutas con este dato en `data` se indexan; todas las demás llevan noindex.
  indexableRouteDataKey: 'indexable',
  robots: { indexable: 'index, follow', private: 'noindex, nofollow' },
  // Cuadrada: con la tarjeta "summary" las redes la muestran pequeña junto al texto.
  imagePath: 'icons/icon-512x512.png',
  ogType: 'website',
  twitterCard: 'summary',
} as const;
