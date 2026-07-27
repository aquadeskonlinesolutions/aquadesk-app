"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

function ok() {
  revalidatePath("/settings/dive-sites");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

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
