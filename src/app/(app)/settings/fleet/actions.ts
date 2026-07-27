"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

function ok() {
  revalidatePath("/settings/fleet");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

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
