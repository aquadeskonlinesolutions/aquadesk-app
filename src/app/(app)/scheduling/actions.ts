"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  loadTripsForDate,
  loadTripDetail,
  searchDiversForAssignment,
  loadActiveGroups,
  loadGroupMembersForAssignment,
  loadScheduleDivers,
  loadDayAssignmentsForWarnings,
  loadAllGroups,
  checkGroupDeletionBlockers,
  type TripSummary,
  type TripDetail,
  type DiverPickResult,
  type GroupOption,
  type ScheduleDiverRow,
  type DayAssignment,
  type GroupListItem,
  type GroupDeletionBlocker,
} from "./data";

export async function getTripsForDate(date: string): Promise<TripSummary[]> {
  const user = await getCurrentUser();
  return loadTripsForDate(user.diveCenterId, date);
}

export async function getTripDetail(scheduleId: string): Promise<TripDetail | null> {
  const user = await getCurrentUser();
  return loadTripDetail(user.diveCenterId, scheduleId);
}

export async function searchDivers(
  query: string,
  scheduleDate: string,
  excludeScheduleId: string | null,
): Promise<DiverPickResult[]> {
  const user = await getCurrentUser();
  if (query.trim().length < 2) return [];
  return searchDiversForAssignment(user.diveCenterId, query.trim(), scheduleDate, excludeScheduleId);
}

export async function getActiveGroups(): Promise<GroupOption[]> {
  const user = await getCurrentUser();
  return loadActiveGroups(user.diveCenterId);
}

export async function getGroupMembers(
  groupId: string,
  scheduleDate: string,
  excludeScheduleId: string | null,
): Promise<DiverPickResult[]> {
  const user = await getCurrentUser();
  return loadGroupMembersForAssignment(user.diveCenterId, groupId, scheduleDate, excludeScheduleId);
}

export async function getScheduleDivers(scheduleId: string): Promise<ScheduleDiverRow[]> {
  const user = await getCurrentUser();
  return loadScheduleDivers(user.diveCenterId, scheduleId);
}

export async function getDayAssignmentsForWarnings(
  scheduleDate: string,
  excludeScheduleId: string | null,
): Promise<DayAssignment[]> {
  const user = await getCurrentUser();
  return loadDayAssignmentsForWarnings(user.diveCenterId, scheduleDate, excludeScheduleId);
}

function ok() {
  revalidatePath("/scheduling");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

export type TripFormInput = {
  scheduleDate: string;
  boatMode: "own_boat" | "join_ride" | "rental";
  boatId: string | null;
  joinerBoatName: string;
  departureTime: string;
  siteIds: string[];
  notes: string;
  guestDiversCount: number | null;
  guestDiveCenterName: string;
  guestNotes: string;
};

async function replaceScheduleSites(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  scheduleId: string,
  siteIds: string[],
) {
  await supabase.from("schedule_sites").delete().eq("schedule_id", scheduleId);
  if (siteIds.length === 0) return;
  await supabase.from("schedule_sites").insert(
    siteIds.map((diveSiteId, index) => ({
      dive_center_id: diveCenterId,
      schedule_id: scheduleId,
      dive_site_id: diveSiteId,
      sort_order: index,
    })),
  );
}

export async function createTrip(
  input: TripFormInput,
): Promise<{ error?: string; scheduleId?: string }> {
  const user = await getCurrentUser();
  if (!input.scheduleDate) return fail("A date is required.");
  if (input.siteIds.length === 0) return fail("At least one dive site is required.");
  const supabase = await createClient();

  const isJoiner = input.boatMode !== "own_boat";
  const { data, error } = await supabase
    .from("schedules")
    .insert({
      dive_center_id: user.diveCenterId,
      schedule_date: input.scheduleDate,
      boat_id: isJoiner ? null : input.boatId,
      is_joiner: isJoiner,
      joiner_boat_name: isJoiner ? input.joinerBoatName.trim() || null : null,
      departure_time: input.departureTime || null,
      notes: input.notes.trim() || null,
      guest_divers_count: input.guestDiversCount || null,
      guest_dive_center_name: input.guestDiveCenterName.trim() || null,
      guest_notes: input.guestNotes.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return fail(error.message);
  await replaceScheduleSites(supabase, user.diveCenterId, data.id, input.siteIds);

  revalidatePath("/scheduling");
  return { scheduleId: data.id };
}

export async function updateTrip(
  scheduleId: string,
  input: TripFormInput,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!input.scheduleDate) return fail("A date is required.");
  if (input.siteIds.length === 0) return fail("At least one dive site is required.");
  const supabase = await createClient();

  const isJoiner = input.boatMode !== "own_boat";
  const { error } = await supabase
    .from("schedules")
    .update({
      schedule_date: input.scheduleDate,
      boat_id: isJoiner ? null : input.boatId,
      is_joiner: isJoiner,
      joiner_boat_name: isJoiner ? input.joinerBoatName.trim() || null : null,
      departure_time: input.departureTime || null,
      notes: input.notes.trim() || null,
      guest_divers_count: input.guestDiversCount || null,
      guest_dive_center_name: input.guestDiveCenterName.trim() || null,
      guest_notes: input.guestNotes.trim() || null,
    })
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return fail(error.message);
  await replaceScheduleSites(supabase, user.diveCenterId, scheduleId, input.siteIds);
  return ok();
}

export async function deleteTrip(scheduleId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: schedule } = await supabase
    .from("schedules")
    .select("id, closed")
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (!schedule) return fail("Trip not found.");
  if (schedule.closed) return fail("A closed trip can't be deleted.");

  const { count } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", scheduleId);
  if (count && count > 0) {
    return fail("This trip already has billing activity and can't be deleted — cancel it instead.");
  }

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function cancelTrip(scheduleId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: schedule } = await supabase
    .from("schedules")
    .select("id, closed")
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (!schedule) return fail("Trip not found.");
  if (schedule.closed) return fail("A closed trip can't be cancelled.");

  const { error } = await supabase
    .from("schedules")
    .update({ cancelled: true })
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export type DiverAssignmentInput = {
  diverId: string;
  openVisitId: string | null;
  staffId: string | null;
  experienceType: "fun_diving" | "dive_course";
  courseRateId: string | null;
  is15L: boolean;
  nitroxRequested: boolean;
  rememberStaffPairing: boolean;
};

export async function saveTripDiverAssignments(
  scheduleId: string,
  assignments: DiverAssignmentInput[],
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: schedule } = await supabase
    .from("schedules")
    .select("id, closed")
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (!schedule) return fail("Trip not found.");
  if (schedule.closed) return fail("A closed trip can't be edited.");

  // Ensure every diver has an open visit matching their assigned experience
  // type — reuses the exact same insert shape as divers/[id]/actions.ts's
  // createVisit, written fresh here per this codebase's established
  // self-contained-per-page convention (no cross-page action imports).
  for (const a of assignments) {
    if (a.openVisitId) continue;
    const { error: visitError } = await supabase.from("visits").insert({
      dive_center_id: user.diveCenterId,
      diver_id: a.diverId,
      experience_type: a.experienceType,
      course_rate_id: a.experienceType === "dive_course" ? a.courseRateId : null,
      visit_status: "open",
      is_active: true,
      is_paid: false,
    });
    if (visitError) return fail(`Could not start a visit for one diver: ${visitError.message}`);
  }

  // schedule_divers has no independent identity beyond the trip — delete +
  // reinsert fresh on every save, same reasoning as schedule_sites.
  await supabase.from("schedule_divers").delete().eq("schedule_id", scheduleId);
  if (assignments.length > 0) {
    const { error: insertError } = await supabase.from("schedule_divers").insert(
      assignments.map((a) => ({
        dive_center_id: user.diveCenterId,
        schedule_id: scheduleId,
        diver_id: a.diverId,
        staff_id: a.staffId,
        experience_type: a.experienceType,
        is_15l: a.is15L,
        nitrox_requested: a.nitroxRequested,
      })),
    );
    if (insertError) return fail(insertError.message);
  }

  // "Remember this pairing" — upsert or clear diver_staff_defaults per the
  // explicit per-diver toggle, never a whole-team carry-over.
  for (const a of assignments) {
    if (a.rememberStaffPairing && a.staffId) {
      await supabase
        .from("diver_staff_defaults")
        .upsert(
          { dive_center_id: user.diveCenterId, diver_id: a.diverId, staff_id: a.staffId },
          { onConflict: "dive_center_id,diver_id" },
        );
    } else if (!a.rememberStaffPairing) {
      await supabase
        .from("diver_staff_defaults")
        .delete()
        .eq("dive_center_id", user.diveCenterId)
        .eq("diver_id", a.diverId);
    }
  }

  return ok();
}

function nowManilaMinute(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Only writes bare, zero-priced activities rows — no pricing logic here at
// all. Real pricing happens later via Diver Detail's existing Auto-Price/
// manual-edit flow, per the explicit user decision behind this build.
export async function markBoatReturned(
  scheduleId: string,
  fuelLitersConsumed: number | null,
): Promise<{ error?: string; skippedDivers?: string[] }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: schedule } = await supabase
    .from("schedules")
    .select("id, schedule_date, departure_time, is_joiner, boat_id, closed, cancelled")
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (!schedule) return fail("Trip not found.");
  if (schedule.closed) return fail("This trip is already closed.");
  if (schedule.cancelled) return fail("A cancelled trip can't be closed.");

  if (schedule.departure_time) {
    const departureAt = `${schedule.schedule_date}T${schedule.departure_time.slice(0, 5)}`;
    if (nowManilaMinute() < departureAt) {
      return fail("This trip's departure time hasn't passed yet.");
    }
  }

  const [{ data: diverRows }, { data: siteRows }] = await Promise.all([
    supabase
      .from("schedule_divers")
      .select("diver_id, staff_id")
      .eq("dive_center_id", user.diveCenterId)
      .eq("schedule_id", scheduleId),
    supabase
      .from("schedule_sites")
      .select("dive_site_id, dive_sites(site_name)")
      .eq("schedule_id", scheduleId)
      .order("sort_order"),
  ]);

  const siteNames = (siteRows ?? [])
    .map((r) => {
      const rel = r.dive_sites as unknown;
      const site = Array.isArray(rel) ? rel[0] : rel;
      return (site as { site_name?: string } | null)?.site_name ?? null;
    })
    .filter((n): n is string => !!n);

  const staffIds = [...new Set((diverRows ?? []).map((r) => r.staff_id).filter(Boolean))] as string[];
  const { data: staffRows } = staffIds.length
    ? await supabase.from("staff").select("id, first_name, last_name").in("id", staffIds)
    : { data: [] };
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`]));

  const skippedDivers: string[] = [];
  const activityRows: Record<string, unknown>[] = [];

  for (const row of diverRows ?? []) {
    const { data: visit } = await supabase
      .from("visits")
      .select("id")
      .eq("dive_center_id", user.diveCenterId)
      .eq("diver_id", row.diver_id)
      .eq("visit_status", "open")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!visit) {
      const { data: diver } = await supabase
        .from("divers")
        .select("first_name, last_name")
        .eq("id", row.diver_id)
        .single();
      skippedDivers.push(diver ? `${diver.first_name} ${diver.last_name}` : row.diver_id);
      continue;
    }

    const staffName = row.staff_id ? staffNameById.get(row.staff_id) ?? null : null;
    const sitesForRow = siteNames.length > 0 ? siteNames : [null];
    for (const siteName of sitesForRow) {
      activityRows.push({
        dive_center_id: user.diveCenterId,
        diver_id: row.diver_id,
        visit_id: visit.id,
        schedule_id: scheduleId,
        date: schedule.schedule_date,
        dive_site: siteName,
        staff_name: staffName,
        status: "completed",
      });
    }
  }

  if (activityRows.length > 0) {
    const { error: activityError } = await supabase.from("activities").insert(activityRows);
    if (activityError) return fail(activityError.message);
  }

  if (!schedule.is_joiner && fuelLitersConsumed && fuelLitersConsumed > 0 && schedule.boat_id) {
    const { data: boat } = await supabase
      .from("boats")
      .select("fuel_type")
      .eq("id", schedule.boat_id)
      .single();

    if (boat?.fuel_type) {
      await supabase.from("fuel_logs").insert({
        dive_center_id: user.diveCenterId,
        boat_id: schedule.boat_id,
        schedule_id: scheduleId,
        fuel_type: boat.fuel_type,
        liters_consumed: fuelLitersConsumed,
        dive_count: siteNames.length,
        diver_count: (diverRows ?? []).length,
      });

      const levelColumn = boat.fuel_type === "gasoline" ? "fuel_gasoline_level" : "fuel_diesel_level";
      const { data: dc } = await supabase
        .from("dive_centers")
        .select(levelColumn)
        .eq("id", user.diveCenterId)
        .single();
      const currentLevel = (dc as Record<string, number | null> | null)?.[levelColumn];
      if (currentLevel != null) {
        await supabase
          .from("dive_centers")
          .update({ [levelColumn]: currentLevel - fuelLitersConsumed })
          .eq("id", user.diveCenterId);
      }
    }
  }

  await supabase
    .from("schedules")
    .update({ closed: true, fuel_consumed_liters: fuelLitersConsumed })
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId);

  revalidatePath("/scheduling");
  return skippedDivers.length > 0 ? { skippedDivers } : {};
}

export async function getAllGroups(): Promise<GroupListItem[]> {
  const user = await getCurrentUser();
  return loadAllGroups(user.diveCenterId);
}

export async function createRegistrationLinkGroup(input: {
  groupName: string;
  leaderName: string;
  arrivalDate: string;
  departureDate: string;
  expectedCount: string;
  notes: string;
}): Promise<{ error?: string; groupId?: string; registrationLink?: string }> {
  const user = await getCurrentUser();
  if (!input.groupName.trim()) return fail("Group name is required.");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .insert({
      dive_center_id: user.diveCenterId,
      group_name: input.groupName.trim(),
      leader_name: input.leaderName.trim() || null,
      arrival_date: input.arrivalDate || null,
      departure_date: input.departureDate || null,
      expected_count: input.expectedCount.trim() ? Number(input.expectedCount) : null,
      notes: input.notes.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return fail(error.message);
  revalidatePath("/scheduling");
  return {
    groupId: data.id,
    registrationLink: `/register?dc=${user.diveCenterId}&group=${data.id}`,
  };
}

export async function createAdHocGroup(
  groupName: string,
  diverIds: string[],
): Promise<{ error?: string; groupId?: string }> {
  const user = await getCurrentUser();
  if (!groupName.trim()) return fail("Group name is required.");
  if (diverIds.length < 2) return fail("Select at least 2 divers.");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .insert({ dive_center_id: user.diveCenterId, group_name: groupName.trim(), is_active: true })
    .select("id")
    .single();
  if (error) return fail(error.message);

  const { error: updateError } = await supabase
    .from("divers")
    .update({ group_id: data.id })
    .in("id", diverIds)
    .eq("dive_center_id", user.diveCenterId);
  if (updateError) return fail(updateError.message);

  revalidatePath("/scheduling");
  return { groupId: data.id };
}

export async function getGroupDeletionBlockers(groupId: string): Promise<GroupDeletionBlocker[]> {
  const user = await getCurrentUser();
  return checkGroupDeletionBlockers(user.diveCenterId, groupId);
}

export async function deleteGroup(groupId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const blockers = await checkGroupDeletionBlockers(user.diveCenterId, groupId);
  if (blockers.length > 0) {
    return fail(
      `Can't delete — ${blockers.map((b) => `${b.diverName} (${b.reasons.join(", ")})`).join("; ")}.`,
    );
  }

  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  revalidatePath("/scheduling");
  return ok();
}
