"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

function ok() {
  revalidatePath("/settings/equipment-rental");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

export async function saveDefaultEquipmentRate(
  itemName: string,
  rate: number,
  chargeType: "per_dive" | "per_day",
) {
  const user = await requireOwner();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("equipment_rental_rates")
    .select("id")
    .eq("dive_center_id", user.diveCenterId)
    .eq("item_name", itemName)
    .maybeSingle();

  const payload = {
    dive_center_id: user.diveCenterId,
    item_name: itemName,
    rate,
    charge_type: chargeType,
    is_active: true,
  };
  const { error } = existing
    ? await supabase.from("equipment_rental_rates").update(payload).eq("id", existing.id)
    : await supabase.from("equipment_rental_rates").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function addCustomEquipmentRate(
  itemName: string,
  rate: number,
  chargeType: "per_dive" | "per_day",
) {
  const user = await requireOwner();
  if (!itemName.trim()) return fail("Equipment name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("equipment_rental_rates").insert({
    dive_center_id: user.diveCenterId,
    item_name: itemName.trim(),
    rate,
    charge_type: chargeType,
    is_active: true,
  });
  if (error) return fail(error.message);
  return ok();
}

export async function updateEquipmentRateAmount(id: string, rate: number) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipment_rental_rates")
    .update({ rate })
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteEquipmentRate(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipment_rental_rates")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}
