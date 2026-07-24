"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { TANK_TYPES, GEAR_ITEMS } from "./constants";

function ok() {
  revalidatePath("/settings/equipment");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

// ── BOATS (FLEET) ────────────────────────────────────────────────────────

export async function saveBoat(
  id: string | null,
  name: string,
  boatType: string,
  fuelType: string,
  capacity: number | null,
  captain: string,
) {
  const user = await requireOwner();
  if (!name.trim()) return fail("Boat name is required.");
  const supabase = await createClient();

  const payload = {
    dive_center_id: user.diveCenterId,
    name: name.trim(),
    boat_type: boatType,
    fuel_type: fuelType,
    capacity,
    captain: captain.trim() || null,
    is_active: true,
  };
  const { error } = id
    ? await supabase.from("boats").update(payload).eq("id", id)
    : await supabase.from("boats").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteBoat(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("boats")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── DIVE SITES ───────────────────────────────────────────────────────────

export async function saveDiveSite(
  id: string | null,
  siteName: string,
  distance: string,
  fuelEstimate: "Low" | "Medium" | "High",
  sharkFee: boolean,
  linkedPackageId: string | null,
) {
  const user = await requireOwner();
  if (!siteName.trim()) return fail("Site name is required.");
  const supabase = await createClient();

  const payload = {
    dive_center_id: user.diveCenterId,
    site_name: siteName.trim(),
    distance: distance.trim() || null,
    fuel_estimate: fuelEstimate,
    shark_fee: sharkFee,
    linked_package_id: linkedPackageId,
    is_active: true,
  };
  const { error } = id
    ? await supabase.from("dive_sites").update(payload).eq("id", id)
    : await supabase.from("dive_sites").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteDiveSite(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("dive_sites")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── TANKS ────────────────────────────────────────────────────────────────

export type TankRowInput = {
  id: string | null;
  type: string;
  totalCount: number;
  availableCount: number;
  inUseCount: number;
  lowAlertThreshold: number;
};

export async function saveTanks(rows: TankRowInput[]) {
  const user = await requireOwner();
  const supabase = await createClient();
  const validTypes = new Set(TANK_TYPES.map((t) => t.value));

  for (const row of rows) {
    if (!validTypes.has(row.type)) continue;
    const payload = {
      dive_center_id: user.diveCenterId,
      type: row.type,
      total_count: row.totalCount,
      available_count: row.availableCount,
      in_use_count: row.inUseCount,
      low_alert_threshold: row.lowAlertThreshold,
    };
    const { error } = row.id
      ? await supabase.from("tanks").update(payload).eq("id", row.id)
      : await supabase.from("tanks").insert(payload);
    if (error) return fail(error.message);
  }
  return ok();
}

// ── FUEL ─────────────────────────────────────────────────────────────────

export async function saveFuelSettings(
  gasolineLevel: number | null,
  gasolineThreshold: number | null,
  dieselLevel: number | null,
  dieselThreshold: number | null,
) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("dive_centers")
    .update({
      fuel_gasoline_level: gasolineLevel,
      fuel_gasoline_threshold: gasolineThreshold,
      fuel_diesel_level: dieselLevel,
      fuel_diesel_threshold: dieselThreshold,
    })
    .eq("id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function resetFuelConsumed(fuelType: "gasoline" | "diesel") {
  const user = await requireOwner();
  const supabase = await createClient();
  const column = fuelType === "gasoline" ? "fuel_gasoline_last_reset_at" : "fuel_diesel_last_reset_at";
  const { error } = await supabase
    .from("dive_centers")
    .update({ [column]: new Date().toISOString() })
    .eq("id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── RENTAL GEAR ──────────────────────────────────────────────────────────

export type GearRowInput = {
  id: string | null;
  name: string;
  totalCount: number;
  lowAlertThreshold: number;
};

export async function saveGear(rows: GearRowInput[]) {
  const user = await requireOwner();
  const supabase = await createClient();
  const validNames = new Set(GEAR_ITEMS);

  for (const row of rows) {
    if (!validNames.has(row.name)) continue;
    const payload = {
      dive_center_id: user.diveCenterId,
      name: row.name,
      total_count: row.totalCount,
      low_alert_threshold: row.lowAlertThreshold,
      is_active: true,
    };
    const { error } = row.id
      ? await supabase.from("equipment").update(payload).eq("id", row.id)
      : await supabase.from("equipment").insert(payload);
    if (error) return fail(error.message);
  }
  return ok();
}
