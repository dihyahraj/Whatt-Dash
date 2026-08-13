import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    // Use internal URL for server-side (Docker network), fallback to public URL
    const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    _supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      // Server-side, service-role client: it must never try to manage or persist
      // a user session. Reusing one instance also reuses keep-alive sockets to
      // PostgREST (this client holds no per-request state).
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return _supabase;
}

/**
 * Lazy façade so modules can `import { supabase }` at top level without
 * constructing the client (and reading env vars) at import time.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});
