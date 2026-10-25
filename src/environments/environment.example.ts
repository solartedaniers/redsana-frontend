// Copia este archivo a environment.ts (ignorado por git) con tus valores, o deja que `npm run build` lo genere desde .env.
export const environment = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  apiBaseUrl: 'http://localhost:8000',
  desktopDownloadUrl:
    'https://github.com/solartedaniers/redsana-frontend/releases/latest/download/RedSana_x64-setup.exe',
  webAppUrl: 'https://www.app-redsana.com',
  // /health público del servicio de IA, para despertarlo desde el cliente; vacío lo desactiva.
  aiServicePublicUrl: '',
  // Credenciales de ejemplo del login (requisito académico); apagadas y vacías por defecto.
  demoLogin: { enabled: false, email: '', password: '' },
};
