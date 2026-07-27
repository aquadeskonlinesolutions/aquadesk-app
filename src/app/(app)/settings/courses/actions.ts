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
) {
  const user = await requireOwner();
  if (!courseName.trim()) return fail("Course name is required.");
  const supabase = await createClient();

  const payload = {
    dive_center_id: user.diveCenterId,
    course_name: courseName.trim(),
    rate,
    is_active: true,
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
