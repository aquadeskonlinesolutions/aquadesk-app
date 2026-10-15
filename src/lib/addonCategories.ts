import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AddonCategoryOption = { id: string; label: string };

// This dive center's own add-on categories (migration 059), for the Bill
// Summary dropdown. Same pattern as payment channels / expense categories.
export async function loadAddonCategories(supabase: Supabase, diveCenterId: string): Promise<AddonCategoryOption[]> {
  const { data } = await supabase
    .from("addon_categories")
    .select("id, label")
    .eq("dive_center_id", diveCenterId)
    .order("label", { ascending: true });
  return data ?? [];
}

// Exactly one of categoryId / newLabel should be set. categoryId reuses an
// existing category of this dive center; newLabel is what was typed via
// "+ Add Category": matched case-insensitively and trimmed against this dive
// center's existing categories first ("Van" and "van " are the same one),
// otherwise created. A pasted id from another dive center is refused.
export async function resolveAddonCategory(
  supabase: Supabase,
  diveCenterId: string,
  args: { categoryId: string | null; newLabel: string | null },
): Promise<{ error: string } | { id: string; label: string }> {
  if (args.categoryId) {
    const { data } = await supabase
      .from("addon_categories")
      .select("id, label")
      .eq("id", args.categoryId)
      .eq("dive_center_id", diveCenterId)
      .maybeSingle();
    if (!data) return { error: "That category isn't available. Pick another one." };
    return { id: data.id, label: data.label };
  }

  const typed = (args.newLabel ?? "").trim().replace(/\s+/g, " ");
  if (!typed) return { error: "Enter a category name." };
  if (typed.length > 60) return { error: "Category names can be up to 60 characters." };
  const normalized = typed.toLowerCase();

  const { data: existing } = await supabase
    .from("addon_categories")
    .select("id, label")
    .eq("dive_center_id", diveCenterId)
    .eq("normalized_label", normalized)
    .maybeSingle();
  if (existing) return { id: existing.id, label: existing.label };

  const { data: created, error } = await supabase
    .from("addon_categories")
    .insert({ dive_center_id: diveCenterId, label: typed, normalized_label: normalized })
    .select("id, label")
    .single();
  if (error) {
    // Two people adding the same new category at the same moment: the unique
    // constraint catches it; use whichever row won.
    if (error.code === "23505") {
      const { data: winner } = await supabase
        .from("addon_categories")
        .select("id, label")
        .eq("dive_center_id", diveCenterId)
        .eq("normalized_label", normalized)
        .maybeSingle();
      if (winner) return { id: winner.id, label: winner.label };
    }
    return { error: error.message };
  }
  return { id: created.id, label: created.label };
}
