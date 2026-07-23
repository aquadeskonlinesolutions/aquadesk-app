import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Component/Action/Route Handler client. Reads the caller's own
// session from cookies, so every query still goes through Postgres RLS as
// that specific user (owner/secretary/platform admin) — this client has no
// elevated access of its own.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render, where cookies can't be
            // written. Safe to ignore as long as the proxy also refreshes
            // the session (see proxy.ts).
          }
        },
      },
    },
  );
}
