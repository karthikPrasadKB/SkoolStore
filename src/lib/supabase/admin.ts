import "server-only";
import { createClient } from "@supabase/supabase-js";

// Full-access Supabase client for the few things a normal user can't do (e.g. creating staff accounts).
// Uses the SECRET key, so it must only ever run on the server, and only after checking the caller is an admin.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
