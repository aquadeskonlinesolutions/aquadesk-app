"use server";

import { getCurrentUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { loadTripsForDate, loadManifestDetail } from "./data";

export async function getTripsForDate(date: string) {
  const user = await getCurrentUser();
  return loadTripsForDate(user.diveCenterId, date);
}

export async function getManifestDetail(scheduleId: string) {
  const user = await getCurrentUser();
  return loadManifestDetail(user.diveCenterId, scheduleId);
}

// A manifests row always exists for every schedule — create_manifest_for_schedule()
// (001_schema_and_rls.sql) inserts one automatically the moment a schedule
// row is created, so this only ever needs to update, never insert.
export async function saveManifestFields(
  scheduleId: string,
  district: string,
  port: string,
) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("manifests")
    .update({
      district: district || null,
      port: port || null,
      last_edited_at: new Date().toISOString(),
    })
    .eq("schedule_id", scheduleId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  return { error: undefined };
}
