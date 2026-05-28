import { createClient } from '@supabase/supabase-js';

// Service role client — full access, backend only, never exposed to frontend
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Create a client scoped to a user's JWT for RLS-respecting operations
export function supabaseForUser(jwt) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}
