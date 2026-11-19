import { createClient } from '@supabase/supabase-js';
import { readStoredToken } from '../../services/sessionStore';

const previewPath = '/api/homologacao/supabase';
export const isSupabasePreviewReadOnly = import.meta.env.VITE_HOMOLOGACAO_SUPABASE_CONSULTA === '1' && typeof window !== 'undefined';
const supabaseUrl = isSupabasePreviewReadOnly ? window.location.origin + previewPath : (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = isSupabasePreviewReadOnly ? 'consulta-itam-preview' : (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const previewFetch: typeof fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(previewPath + '/rest/v1/')) {
    return fetch(input, init);
  }
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  if (method.toUpperCase() !== 'GET') {
    return Promise.resolve(Response.json({ message: 'Na prévia, esta base está disponível somente para consulta.' }, { status: 405 }));
  }
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const token = readStoredToken();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  return fetch(input, { ...init, headers });
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(isSupabasePreviewReadOnly ? { global: { fetch: previewFetch } } : {}),
    })
  : null;
