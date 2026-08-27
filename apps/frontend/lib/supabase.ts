import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']) || '';
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
