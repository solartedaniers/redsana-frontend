/** Única fuente de las URLs: renombrar una ruta es cambiar una línea aquí. */
export const ROUTE_SEGMENTS = {
  auth: 'auth',
  user: 'user',
  admin: 'admin',
  account: 'account',
  login: 'login',
  register: 'register',
  forgotPassword: 'forgot-password',
  resetPassword: 'reset-password',
  dashboard: 'dashboard',
  securityAssistant: 'security-assistant',
  alerts: 'alerts',
  devices: 'devices',
  familyMode: 'family-mode',
  download: 'download',
  networkSupervision: 'network-supervision',
  users: 'users',
  profile: 'profile',
} as const;

const segment = ROUTE_SEGMENTS;
const path = (...parts: string[]): string => `/${parts.join('/')}`;

export const APP_PATHS = {
  root: '/',
  login: path(segment.auth, segment.login),
  register: path(segment.auth, segment.register),
  forgotPassword: path(segment.auth, segment.forgotPassword),
  resetPassword: path(segment.auth, segment.resetPassword),
  userDashboard: path(segment.user, segment.dashboard),
  securityAssistant: path(segment.user, segment.securityAssistant),
  alerts: path(segment.user, segment.alerts),
  devices: path(segment.user, segment.devices),
  familyMode: path(segment.user, segment.familyMode),
  download: path(segment.user, segment.download),
  adminDashboard: path(segment.admin, segment.dashboard),
  networkSupervision: path(segment.admin, segment.networkSupervision),
  adminUsers: path(segment.admin, segment.users),
  profile: path(segment.account, segment.profile),
} as const;
