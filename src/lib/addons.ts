import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The ONE place the app asks "how much in add-ons does each visit have?"
// (migration 059's visit_addons_totals). Every screen and server action that
// works out what a diver owes goes through here, so they always agree. Runs as
// the signed-in user (RLS), so it only ever sees their own dive center's rows.
// A visit with no add-ons is simply absent from the map (callers use `?? 0`).
export async function loadAddonTotals(supabase: Supabase, visitIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(visitIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const { data } = await supabase.rpc("visit_addons_totals", { p_visit_ids: ids });
  (data as { visit_id: string; total: number | string }[] | null)?.forEach((r) => {
    out.set(r.visit_id, Number(r.total) || 0);
  });
  return out;
}
