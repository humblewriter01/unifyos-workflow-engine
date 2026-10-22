import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';

/**
 * Supabase expects the bare project origin, e.g.
 * `https://gsuipjnxshrqelmicvyo.supabase.co`.
 *
 * A trailing slash, a copied `/rest/v1` path, or a missing scheme produces
 * malformed request URLs and 404s that look like auth failures. Normalise the
 * value here so every environment behaves the same.
 */
export function normalizeSupabaseUrl(value?: string): string {
  if (!value) return '';
  let url = value.trim().replace(/^['"]+/, '').replace(/['"]+$/, '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/(rest|auth|storage|realtime)\/v1$/i, '');
  return url.replace(/\/+$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(getEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']));
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY']) || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.warn('[Supabase] Invalid configuration; continuing without Supabase:', error);
  }
}

/**
 * The Supabase client is intentionally nullable. Dashboard routes use it when
 * configured and return an empty, usable state when the service is not enabled.
 */
export const supabase = client;

export default supabase;
