import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only ever use this for the
// specific privileged operations that intentionally have no client-side RLS
// policy at all (creating a dive center + its first owner account). Never
// import this outside a Server Action/Route Handler, and never after
// anything but an explicit platform-admin check.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
