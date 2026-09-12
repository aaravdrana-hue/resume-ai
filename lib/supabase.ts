import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client. It uses the service_role key, which bypasses
// Row Level Security — so this module must NEVER be imported into client
// components. Only API route handlers (which run on the server) may use it.

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }

  // Reuse a single client across requests in the same server process.
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}
