"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import { resolveAddonCategory, type AddonCategoryOption } from "@/lib/addonCategories";

export type AddonInput = {
  description: string;
  // Exactly one of these: an existing category's id, or the typed name of a new one.
  categoryId: string | null;
  newCategoryLabel: string | null;
  amount: number;
};

export type SavedAddon = {
  id: string;
  description: string;
  categoryId: string | null;
  categoryName: string;
  amount: number;
};

type Result = { error?: string; addon?: SavedAddon; category?: AddonCategoryOption };

const CLOSED_BILL_ERROR = "This bill is closed. Unlock it with the billing password before changing it.";

// Server-side validation — the screen's checks are a convenience only.
function validate(input: AddonInput): { error: string } | { description: string; amount: number } {
  const description = String(input.description ?? "").trim().replace(/\s+/g, " ");
  if (!description) return { error: "Enter a description for the add-on." };
  if (description.length > 200) return { error: "The description can be up to 200 characters." };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "The amount must be greater than 0." };
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return { error: "The amount can have at most 2 decimals." };
  }
  if (amount > 9999999.99) return { error: "That amount is too large." };
  return { description, amount: Math.round(amount * 100) / 100 };
}

async function openVisit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  visitId: string,
): Promise<{ error: string } | { diverId: string }> {
  const { data } = await supabase
    .from("visits")
    .select("diver_id, visit_status")
    .eq("id", visitId)
    .eq("dive_center_id", diveCenterId)
    .maybeSingle();
  if (!data) return { error: "Visit not found." };
  if (data.visit_status !== "open") return { error: CLOSED_BILL_ERROR };
  return { diverId: data.diver_id };
}

function toSaved(data: {
  id: string;
  description: string;
  category_id: string | null;
  category_name: string;
  amount: number | string;
}): SavedAddon {
  return {
    id: data.id,
    description: data.description,
    categoryId: data.category_id,
    categoryName: data.category_name,
    amount: Number(data.amount),
  };
}

export async function addVisitAddon(diverId: string, visitId: string, input: AddonInput): Promise<Result> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const v = validate(input);
  if ("error" in v) return { error: v.error };
  const visit = await openVisit(supabase, user.diveCenterId, visitId);
  if ("error" in visit) return { error: visit.error };

  const cat = await resolveAddonCategory(supabase, user.diveCenterId, {
    categoryId: input.categoryId,
    newLabel: input.newCategoryLabel,
  });
  if ("error" in cat) return { error: cat.error };

  const { data, error } = await supabase
    .from("visit_addons")
    .insert({
      dive_center_id: user.diveCenterId,
      visit_id: visitId,
      diver_id: visit.diverId,
      description: v.description,
      category_id: cat.id,
      category_name: cat.label,
      amount: v.amount,
      created_by: user.id,
    })
    .select("id, description, category_id, category_name, amount")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/diver-form/${diverId}`);
  return { addon: toSaved(data), category: { id: cat.id, label: cat.label } };
}

export async function updateVisitAddon(
  diverId: string,
  visitId: string,
  addonId: string,
  input: AddonInput,
): Promise<Result> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const v = validate(input);
  if ("error" in v) return { error: v.error };
  const visit = await openVisit(supabase, user.diveCenterId, visitId);
  if ("error" in visit) return { error: visit.error };

  const cat = await resolveAddonCategory(supabase, user.diveCenterId, {
    categoryId: input.categoryId,
    newLabel: input.newCategoryLabel,
  });
  if ("error" in cat) return { error: cat.error };

  const { data, error } = await supabase
    .from("visit_addons")
    .update({ description: v.description, category_id: cat.id, category_name: cat.label, amount: v.amount })
    .eq("id", addonId)
    .eq("visit_id", visitId)
    .eq("dive_center_id", user.diveCenterId)
    .select("id, description, category_id, category_name, amount")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That add-on no longer exists. Reload the page." };

  revalidatePath(`/diver-form/${diverId}`);
  return { addon: toSaved(data), category: { id: cat.id, label: cat.label } };
}

export async function deleteVisitAddon(diverId: string, visitId: string, addonId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const visit = await openVisit(supabase, user.diveCenterId, visitId);
  if ("error" in visit) return { error: visit.error };

  const { data, error } = await supabase
    .from("visit_addons")
    .delete()
    .eq("id", addonId)
    .eq("visit_id", visitId)
    .eq("dive_center_id", user.diveCenterId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "That add-on no longer exists. Reload the page." };

  revalidatePath(`/diver-form/${diverId}`);
  return {};
}
