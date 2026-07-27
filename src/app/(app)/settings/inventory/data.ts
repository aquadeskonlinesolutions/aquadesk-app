import "server-only";
import { createClient } from "@/lib/supabase/server";
import { TANK_TYPES, GEAR_ITEMS } from "./constants";

export type Tank = {
  id: string | null;
  type: string;
  total_count: number;
  available_count: number;
  in_use_count: number;
  low_alert_threshold: number;
};

export type FuelSettings = {
  gasolineLevel: number | null;
  gasolineThreshold: number | null;
  gasolineConsumed: number;
  dieselLevel: number | null;
  dieselThreshold: number | null;
  dieselConsumed: number;
};

export type GearItem = {
  id: string | null;
  name: string;
  totalCount: number;
  lowAlertThreshold: number;
};

export type InventoryData = {
  tanks: Tank[];
  fuel: FuelSettings;
  gear: GearItem[];
};

export async function loadInventoryData(diveCenterId: string): Promise<InventoryData> {
  const supabase = await createClient();

  const [{ data: dc }, { data: tankRows }, { data: equipmentRows }] = await Promise.all([
    supabase
      .from("dive_centers")
      .select(
        "fuel_gasoline_level, fuel_gasoline_threshold, fuel_gasoline_last_reset_at, fuel_diesel_level, fuel_diesel_threshold, fuel_diesel_last_reset_at",
      )
      .eq("id", diveCenterId)
      .single(),
    supabase
      .from("tanks")
      .select("id, type, total_count, available_count, in_use_count, low_alert_threshold")
      .eq("dive_center_id", diveCenterId),
    supabase
      .from("equipment")
      .select("id, name, total_count, low_alert_threshold")
      .eq("dive_center_id", diveCenterId),
  ]);

  const tanks: Tank[] = TANK_TYPES.map((t) => {
    const existing = (tankRows ?? []).find((r) => r.type === t.value);
    return {
      id: existing?.id ?? null,
      type: t.value,
      total_count: existing?.total_count ?? 0,
      available_count: existing?.available_count ?? 0,
      in_use_count: existing?.in_use_count ?? 0,
      low_alert_threshold: existing?.low_alert_threshold ?? 0,
    };
  });

  async function consumedSince(fuelType: "gasoline" | "diesel", lastResetAt: string | null) {
    let query = supabase
      .from("fuel_logs")
      .select("liters_consumed")
      .eq("dive_center_id", diveCenterId)
      .eq("fuel_type", fuelType);
    if (lastResetAt) query = query.gte("created_at", lastResetAt);
    const { data } = await query;
    return (data ?? []).reduce((sum, row) => sum + (Number(row.liters_consumed) || 0), 0);
  }

  const [gasolineConsumed, dieselConsumed] = await Promise.all([
    consumedSince("gasoline", dc?.fuel_gasoline_last_reset_at ?? null),
    consumedSince("diesel", dc?.fuel_diesel_last_reset_at ?? null),
  ]);

  const gear: GearItem[] = GEAR_ITEMS.map((name) => {
    const existing = (equipmentRows ?? []).find((r) => r.name === name);
    return {
      id: existing?.id ?? null,
      name,
      totalCount: existing?.total_count ?? 0,
      lowAlertThreshold: existing?.low_alert_threshold ?? 0,
    };
  });

  return {
    tanks,
    fuel: {
      gasolineLevel: dc?.fuel_gasoline_level ?? null,
      gasolineThreshold: dc?.fuel_gasoline_threshold ?? null,
      gasolineConsumed,
      dieselLevel: dc?.fuel_diesel_level ?? null,
      dieselThreshold: dc?.fuel_diesel_threshold ?? null,
      dieselConsumed,
    },
    gear,
  };
}
