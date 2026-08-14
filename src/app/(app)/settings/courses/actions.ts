"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

function ok() {
  revalidatePath("/settings/courses");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

export async function saveCourseRate(
  id: string | null,
  courseName: string,
  rate: number,
  equipmentIncluded: boolean,
) {
  const user = await requireOwner();
  if (!courseName.trim()) return fail("Course name is required.");
  const supabase = await createClient();

  const payload = {
    dive_center_id: user.diveCenterId,
    course_name: courseName.trim(),
    rate,
    is_active: true,
    equipment_included: equipmentIncluded,
  };
  const { error } = id
    ? await supabase.from("course_rates").update(payload).eq("id", id)
    : await supabase.from("course_rates").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteCourseRate(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_rates")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function saveBundle(
  id: string | null,
  name: string,
  diveCount: number,
  price: number,
  equipmentIncluded: boolean,
) {
  const user = await requireOwner();
  if (!name.trim()) return fail("Bundle name is required.");
  if (!Number.isInteger(diveCount) || diveCount < 1 || diveCount > 100) {
    return fail("Dive count must be between 1 and 100.");
  }
  if (!(price >= 0)) return fail("Price must be zero or more.");
  const supabase = await createClient();

  const payload = {
    dive_center_id: user.diveCenterId,
    name: name.trim(),
    dive_count: diveCount,
    price,
    equipment_included: equipmentIncluded,
    is_active: true,
  };
  const { error } = id
    ? await supabase.from("bundles").update(payload).eq("id", id)
    : await supabase.from("bundles").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteBundle(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("bundles")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}
