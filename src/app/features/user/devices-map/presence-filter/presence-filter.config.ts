/** 'online': solo lo que vio el último escaneo (como siempre). 'all': también los que ya no responden. */
export type PresenceFilter = 'online' | 'all';

export const PRESENCE_FILTERS: readonly PresenceFilter[] = ['online', 'all'];
export const DEFAULT_PRESENCE_FILTER: PresenceFilter = 'online';
