"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { TANK_TYPES, GEAR_ITEMS } from "./constants";

function ok() {
  revalidatePath("/settings/inventory");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
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
