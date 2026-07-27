import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Boat = {
  id: string;
  name: string;
  boat_type: string | null;
  fuel_type: string | null;
  capacity: number | null;
  captain: string | null;
  is_active: boolean;
};

export type FleetData = {
  boats: Boat[];
};

export async function loadFleetData(diveCenterId: string): Promise<FleetData> {
  const supabase = await createClient();
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, boat_type, fuel_type, capacity, captain, is_active")
    .eq("dive_center_id", diveCenterId)
    .order("created_at");

  return { boats: boats ?? [] };
}
