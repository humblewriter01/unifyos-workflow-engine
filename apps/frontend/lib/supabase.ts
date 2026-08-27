import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

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
