import "server-only";
import { createClient } from "@/lib/supabase/server";

export type EquipmentRentalRate = {
  id: string;
  item_name: string;
  rate: number;
  charge_type: "per_dive" | "per_day";
  is_active: boolean;
};

export type EquipmentRentalData = {
  equipmentRentalRates: EquipmentRentalRate[];
};

export async function loadEquipmentRentalData(diveCenterId: string): Promise<EquipmentRentalData> {
  const supabase = await createClient();
  const { data: equipmentRentalRates } = await supabase
    .from("equipment_rental_rates")
    .select("id, item_name, rate, charge_type, is_active")
    .eq("dive_center_id", diveCenterId)
    .order("item_name");

  return { equipmentRentalRates: equipmentRentalRates ?? [] };
}
