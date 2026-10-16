import { environment } from '../../../environments/environment';

/** Endpoint liviano del backend, sin sesión ni base de datos: lo usan la sonda de latencia web y el despertar del login. */
export const BACKEND_HEALTH_URL = `${environment.apiBaseUrl}/api/health`;
