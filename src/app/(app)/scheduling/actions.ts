"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  loadTripsForDate,
  loadTripDetail,
  loadScheduleDivers,
  loadStaffDiveTanks,
  loadClipsForDate,
  loadDayAssignmentsForWarnings,
  loadPhaseOneData,
  findMatchingClip,
  type TripSummary,
  type TripDetail,
  type ScheduleDiverRow,
  type StaffDiveTanks,
  type DayAssignment,
  type PhaseOneData,
  type Clip,
} from "./data";

export async function getTripsForDate(date: string): Promise<TripSummary[]> {
  const user = await getCurrentUser();
  return loadTripsForDate(user.diveCenterId, date);
}

export async function getTripDetail(scheduleId: string): Promise<TripDetail | null> {
  const user = await getCurrentUser();
  return loadTripDetail(user.diveCenterId, scheduleId);
}

export async function getScheduleDivers(scheduleId: string): Promise<ScheduleDiverRow[]> {
  const user = await getCurrentUser();
  return loadScheduleDivers(user.diveCenterId, scheduleId);
}

export async function getStaffDiveTanks(scheduleId: string): Promise<StaffDiveTanks[]> {
  const user = await getCurrentUser();
  return loadStaffDiveTanks(user.diveCenterId, scheduleId);
}

export async function getDayAssignmentsForWarnings(scheduleDate: string): Promise<DayAssignment[]> {
  const user = await getCurrentUser();
  return loadDayAssignmentsForWarnings(user.diveCenterId, scheduleDate);
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
  tripTypeId: string | null;
  captain: string;
  crew: string[];
  siteIds: string[];
  notes: string;
  fuelConsumedLiters: number | null;
  guestDiversCount: number | null;
  guestDiveCenterName: string;
  guestNotes: string;
  spareTanks: { tankType: "air_12l" | "air_15l" | "nitrox"; quantity: number }[];
};

async function replaceScheduleSites(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  scheduleId: string,
  siteIds: string[],
): Promise<{ error?: string }> {
  await supabase.from("schedule_sites").delete().eq("schedule_id", scheduleId);
  if (siteIds.length === 0) return {};
  // One row per slot (sort_order), not per distinct site — a trip can
  // genuinely revisit the same dive site more than once (e.g. a
  // package's "Kimud, Kimud, Monad" itinerary), so this must never be
  // deduped by dive_site_id.
  const { error } = await supabase.from("schedule_sites").insert(
    siteIds.map((diveSiteId, index) => ({
      dive_center_id: diveCenterId,
      schedule_id: scheduleId,
      dive_site_id: diveSiteId,
      sort_order: index,
    })),
  );
  return error ? { error: error.message } : {};
}

async function replaceScheduleCrew(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  scheduleId: string,
  crew: string[],
) {
  await supabase.from("schedule_crew").delete().eq("schedule_id", scheduleId);
  const names = crew.map((c) => c.trim()).filter(Boolean);
  if (names.length === 0) return;
  await supabase.from("schedule_crew").insert(
    names.map((crewName, index) => ({
      dive_center_id: diveCenterId,
      schedule_id: scheduleId,
      crew_name: crewName,
      sort_order: index,
    })),
  );
}

async function replaceScheduleSpareTanks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  scheduleId: string,
  spareTanks: { tankType: string; quantity: number }[],
) {
  await supabase.from("schedule_spare_tanks").delete().eq("schedule_id", scheduleId);
  if (spareTanks.length === 0) return;
  await supabase.from("schedule_spare_tanks").insert(
    spareTanks.map((t, index) => ({
      dive_center_id: diveCenterId,
      schedule_id: scheduleId,
      tank_type: t.tankType,
      quantity: t.quantity,
      sort_order: index,
    })),
  );
}

// Matches scheduling.html's validateTrip: an own-boat trip needs a
// captain name and a non-negative fuel figure before it can be saved —
// join-ride/rental trips need neither (no boat of ours to fuel/crew).
function validateOwnBoatFields(input: TripFormInput): string | null {
  if (input.boatMode !== "own_boat") return null;
  if (!input.captain.trim()) return "Enter the boat captain before saving this trip.";
  if (input.fuelConsumedLiters === null || input.fuelConsumedLiters < 0) {
    return "Enter the fuel consumption in liters before saving this trip.";
  }
  return null;
}

export async function createTrip(
  input: TripFormInput,
): Promise<{ error?: string; scheduleId?: string }> {
  const user = await getCurrentUser();
  if (!input.scheduleDate) return fail("A date is required.");
  if (input.siteIds.length === 0) return fail("At least one dive site is required.");
  const validationError = validateOwnBoatFields(input);
  if (validationError) return fail(validationError);
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
      trip_type_id: input.tripTypeId,
      captain: isJoiner ? null : input.captain.trim() || null,
      notes: input.notes.trim() || null,
      fuel_consumed_liters: isJoiner ? null : input.fuelConsumedLiters,
      guest_divers_count: input.guestDiversCount || null,
      guest_dive_center_name: input.guestDiveCenterName.trim() || null,
      guest_notes: input.guestNotes.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return fail(error.message);
  const [sitesRes] = await Promise.all([
    replaceScheduleSites(supabase, user.diveCenterId, data.id, input.siteIds),
    replaceScheduleCrew(supabase, user.diveCenterId, data.id, isJoiner ? [] : input.crew),
    replaceScheduleSpareTanks(supabase, user.diveCenterId, data.id, input.spareTanks),
  ]);
  if (sitesRes.error) return fail(sitesRes.error);

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
  const validationError = validateOwnBoatFields(input);
  if (validationError) return fail(validationError);
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
      trip_type_id: input.tripTypeId,
      captain: isJoiner ? null : input.captain.trim() || null,
      notes: input.notes.trim() || null,
      fuel_consumed_liters: isJoiner ? null : input.fuelConsumedLiters,
      guest_divers_count: input.guestDiversCount || null,
      guest_dive_center_name: input.guestDiveCenterName.trim() || null,
      guest_notes: input.guestNotes.trim() || null,
    })
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return fail(error.message);
  const [sitesRes] = await Promise.all([
    replaceScheduleSites(supabase, user.diveCenterId, scheduleId, input.siteIds),
    replaceScheduleCrew(supabase, user.diveCenterId, scheduleId, isJoiner ? [] : input.crew),
    replaceScheduleSpareTanks(supabase, user.diveCenterId, scheduleId, input.spareTanks),
  ]);
  if (sitesRes.error) return fail(sitesRes.error);
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

// A "team" placed on a trip = one clip's worth of divers assigned to one
// staff member, plus per-dive nitrox/15L flags (trip-specific, not part of
// the shared clip). Matches scheduling.html's real Phase 2 mechanism: a
// clip is dropped onto a boat wholesale via "+ Add Team," never a single
// loose diver assigned directly.
//
// Per-dive tank choice: a diver/staff member can be nitrox on one dive and
// plain air on another within the same multi-site trip — schedule_divers'
// own is_15l/nitrox_requested stay single booleans (derived "at least one
// dive uses this tank," read by /staff and other existing consumers
// unchanged); the real per-dive detail lives in the two additive tables
// this writes below, keyed by site index (matching schedule_sites'
// sort_order for the same trip — both derived from the same filtered,
// ordered site list at save time).
export type TripTeamInput = {
  staffId: string | null;
  staffName: string;
  sourceClipId: string | null;
  staffNitroxSiteIndexes: number[];
  divers: {
    diverId: string;
    tanks: { siteIndex: number; tankType: "nitrox" | "air_15l" }[];
    experienceType: "fun_diving" | "dive_course" | null;
  }[];
};

export async function saveTripTeams(
  scheduleId: string,
  teams: TripTeamInput[],
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

  // schedule_divers has no independent identity beyond the trip — delete +
  // reinsert fresh on every save, same reasoning as schedule_sites.
  // schedule_diver_dive_tanks cascades from schedule_divers automatically;
  // schedule_staff_dive_tanks is keyed by schedule_id directly and needs
  // its own delete.
  await supabase.from("schedule_divers").delete().eq("schedule_id", scheduleId);
  await supabase.from("schedule_staff_dive_tanks").delete().eq("schedule_id", scheduleId);

  const rows = teams.flatMap((t) =>
    t.divers.map((d) => ({
      dive_center_id: user.diveCenterId,
      schedule_id: scheduleId,
      diver_id: d.diverId,
      staff_id: t.staffId,
      source_clip_id: t.sourceClipId,
      is_15l: d.tanks.some((tk) => tk.tankType === "air_15l"),
      nitrox_requested: d.tanks.some((tk) => tk.tankType === "nitrox"),
      experience_type: d.experienceType,
    })),
  );
  if (rows.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("schedule_divers")
      .insert(rows)
      .select("id, diver_id");
    if (insertError) return fail(insertError.message);

    const scheduleDiverIdByDiverId = new Map((inserted ?? []).map((r) => [r.diver_id, r.id]));
    const tankRows = teams.flatMap((t) =>
      t.divers.flatMap((d) => {
        const scheduleDiverId = scheduleDiverIdByDiverId.get(d.diverId);
        if (!scheduleDiverId) return [];
        return d.tanks.map((tk) => ({
          dive_center_id: user.diveCenterId,
          schedule_diver_id: scheduleDiverId,
          site_index: tk.siteIndex,
          tank_type: tk.tankType,
        }));
      }),
    );
    if (tankRows.length > 0) {
      const { error: tankError } = await supabase.from("schedule_diver_dive_tanks").insert(tankRows);
      if (tankError) return fail(tankError.message);
    }
  }

  const staffTankRows = teams.flatMap((t) =>
    t.staffNitroxSiteIndexes.map((siteIndex) => ({
      dive_center_id: user.diveCenterId,
      schedule_id: scheduleId,
      staff_name: t.staffName,
      site_index: siteIndex,
    })),
  );
  if (staffTankRows.length > 0) {
    const { error: staffTankError } = await supabase
      .from("schedule_staff_dive_tanks")
      .insert(staffTankRows);
    if (staffTankError) return fail(staffTankError.message);
  }

  return ok();
}

// ── Phase 1: loose divers + suggested team clips ──────────────────────────

export async function getPhaseOneData(scheduleDate: string): Promise<PhaseOneData> {
  const user = await getCurrentUser();
  return loadPhaseOneData(user.diveCenterId, scheduleDate, user.id);
}

export async function getClipsForDate(scheduleDate: string): Promise<Clip[]> {
  const user = await getCurrentUser();
  return loadClipsForDate(user.diveCenterId, scheduleDate);
}

export async function createClip(
  scheduleDate: string,
  staffId: string | null,
  staffName: string,
  isFreelancer: boolean,
  diverIds: string[],
): Promise<{ error?: string; clipId?: string; merged?: boolean }> {
  const user = await getCurrentUser();
  if (!staffName.trim()) return fail("A staff name is required.");
  const supabase = await createClient();

  // scheduling.html doesn't block clipping the same staff member twice —
  // it merges (findExistingStaffClip / confirmClipMerge). Mirrored here as
  // a real DB write: if this staff already has a clip today, add the
  // selected divers to that existing clip instead of creating a duplicate.
  const existingClipId = await findMatchingClip(user.diveCenterId, scheduleDate, staffId, staffName, isFreelancer);
  if (existingClipId) {
    if (diverIds.length > 0) {
      const { data: existingMembers } = await supabase
        .from("schedule_team_clip_divers")
        .select("diver_id")
        .eq("clip_id", existingClipId);
      const alreadyIn = new Set((existingMembers ?? []).map((m) => m.diver_id));
      const newIds = diverIds.filter((id) => !alreadyIn.has(id));
      if (newIds.length > 0) {
        const { error: memberError } = await supabase.from("schedule_team_clip_divers").insert(
          newIds.map((id) => ({
            dive_center_id: user.diveCenterId,
            clip_id: existingClipId,
            diver_id: id,
            excluded_on_date: false,
          })),
        );
        if (memberError) return fail(memberError.message);
      }
    }
    revalidatePath("/scheduling");
    return { clipId: existingClipId, merged: true };
  }

  const { data, error } = await supabase
    .from("schedule_team_clips")
    .insert({
      dive_center_id: user.diveCenterId,
      schedule_date: scheduleDate,
      staff_id: staffId,
      staff_name: staffName.trim(),
      is_freelancer: isFreelancer,
      source: "manual",
      carry_forward: true,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  if (diverIds.length > 0) {
    const { error: memberError } = await supabase.from("schedule_team_clip_divers").insert(
      diverIds.map((id) => ({
        dive_center_id: user.diveCenterId,
        clip_id: data.id,
        diver_id: id,
        excluded_on_date: false,
      })),
    );
    if (memberError) return fail(memberError.message);
  }

  revalidatePath("/scheduling");
  return { clipId: data.id };
}

// Excluding a clip member sets excluded_on_date rather than deleting the
// row, matching the live app — the pairing is remembered for future days,
// just not counted today.
export async function excludeDiverFromClip(clipId: string, diverId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_team_clip_divers")
    .update({ excluded_on_date: true })
    .eq("dive_center_id", user.diveCenterId)
    .eq("clip_id", clipId)
    .eq("diver_id", diverId);
  if (error) return fail(error.message);
  return ok();
}

// Mirror of excludeDiverFromClip — the diver stays on the same clip either
// way, this just flips excluded_on_date back off.
export async function includeDiverInClip(clipId: string, diverId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_team_clip_divers")
    .update({ excluded_on_date: false })
    .eq("dive_center_id", user.diveCenterId)
    .eq("clip_id", clipId)
    .eq("diver_id", diverId);
  if (error) return fail(error.message);
  return ok();
}

export async function moveDiverToClip(
  diverId: string,
  fromClipId: string,
  toClipId: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  await supabase
    .from("schedule_team_clip_divers")
    .delete()
    .eq("dive_center_id", user.diveCenterId)
    .eq("clip_id", fromClipId)
    .eq("diver_id", diverId);

  const { error } = await supabase.from("schedule_team_clip_divers").insert({
    dive_center_id: user.diveCenterId,
    clip_id: toClipId,
    diver_id: diverId,
    excluded_on_date: false,
  });
  if (error) return fail(error.message);
  return ok();
}

export async function deleteClip(clipId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_team_clips")
    .delete()
    .eq("id", clipId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function updateClipStaff(
  clipId: string,
  staffId: string | null,
  staffName: string,
  isFreelancer: boolean,
): Promise<{ error?: string; merged?: boolean }> {
  const user = await getCurrentUser();
  if (!staffName.trim()) return fail("A staff name is required.");
  const supabase = await createClient();

  const { data: thisClip } = await supabase
    .from("schedule_team_clips")
    .select("schedule_date")
    .eq("id", clipId)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (!thisClip) return fail("Clip not found.");

  // Same merge behavior as createClip: if the newly-chosen staff already
  // has a different clip today, fold this clip's members into that one
  // and remove this now-redundant clip, rather than leaving one staff
  // split across two clips.
  const targetClipId = await findMatchingClip(
    user.diveCenterId,
    thisClip.schedule_date,
    staffId,
    staffName,
    isFreelancer,
    clipId,
  );
  if (targetClipId) {
    const { data: myMembers } = await supabase
      .from("schedule_team_clip_divers")
      .select("diver_id, excluded_on_date")
      .eq("clip_id", clipId);
    const { data: targetMembers } = await supabase
      .from("schedule_team_clip_divers")
      .select("diver_id")
      .eq("clip_id", targetClipId);
    const alreadyIn = new Set((targetMembers ?? []).map((m) => m.diver_id));
    const toMove = (myMembers ?? []).filter((m) => !alreadyIn.has(m.diver_id));
    if (toMove.length > 0) {
      const { error: moveError } = await supabase.from("schedule_team_clip_divers").insert(
        toMove.map((m) => ({
          dive_center_id: user.diveCenterId,
          clip_id: targetClipId,
          diver_id: m.diver_id,
          excluded_on_date: m.excluded_on_date,
        })),
      );
      if (moveError) return fail(moveError.message);
    }
    const { error: deleteError } = await supabase
      .from("schedule_team_clips")
      .delete()
      .eq("id", clipId)
      .eq("dive_center_id", user.diveCenterId);
    if (deleteError) return fail(deleteError.message);
    revalidatePath("/scheduling");
    return { merged: true };
  }

  const { error } = await supabase
    .from("schedule_team_clips")
    .update({ staff_id: staffId, staff_name: staffName.trim(), is_freelancer: isFreelancer })
    .eq("id", clipId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function excludeDiverForDay(diverId: string, scheduleDate: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_day_diver_exclusions").upsert(
    {
      dive_center_id: user.diveCenterId,
      diver_id: diverId,
      schedule_date: scheduleDate,
      created_by: user.id,
    },
    { onConflict: "diver_id,schedule_date" },
  );
  if (error) return fail(error.message);
  return ok();
}

export async function includeDiverForDay(diverId: string, scheduleDate: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_day_diver_exclusions")
    .delete()
    .eq("dive_center_id", user.diveCenterId)
    .eq("diver_id", diverId)
    .eq("schedule_date", scheduleDate);
  if (error) return fail(error.message);
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
  options: { excludeDiverIds?: string[]; forceProceed?: boolean } = {},
): Promise<{
  error?: string;
  skippedDivers?: string[];
  duplicates?: { diverId: string; name: string }[];
}> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const excludeSet = new Set(options.excludeDiverIds ?? []);

  const { data: schedule } = await supabase
    .from("schedules")
    .select("id, schedule_date, departure_time, is_joiner, boat_id, fuel_consumed_liters, closed, cancelled")
    .eq("id", scheduleId)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (!schedule) return fail("Trip not found.");
  if (schedule.closed) return fail("This trip is already closed.");
  if (schedule.cancelled) return fail("A cancelled trip can't be closed.");
  const fuelLitersConsumed = schedule.fuel_consumed_liters;

  // Package-mode trips log one combined activities row per diver for the
  // whole trip (dive_site = every real site joined, e.g. "Kimud, Kimud,
  // Monad"), matching scheduling.html's real boatReturnPackage — not one
  // row per site, which is boatReturnTier's shape and stays the default
  // for every other pricing mode.
  const { data: dcPricingRow } = await supabase
    .from("dive_centers")
    .select("pricing_mode")
    .eq("id", user.diveCenterId)
    .single();
  const isPackageMode = dcPricingRow?.pricing_mode === "package";

  if (schedule.departure_time) {
    const departureAt = `${schedule.schedule_date}T${schedule.departure_time.slice(0, 5)}`;
    if (nowManilaMinute() < departureAt) {
      return fail("This trip's departure time hasn't passed yet.");
    }
  }

  const [{ data: diverRows }, { data: siteRows }] = await Promise.all([
    supabase
      .from("schedule_divers")
      .select("id, diver_id, staff_id")
      .eq("dive_center_id", user.diveCenterId)
      .eq("schedule_id", scheduleId),
    supabase
      .from("schedule_sites")
      .select("dive_site_id, dive_sites(site_name)")
      .eq("schedule_id", scheduleId)
      .order("sort_order"),
  ]);

  // Per-dive nitrox/15L tank choice, keyed by (schedule_diver_id,
  // site_index) — the source of truth Diver Form's "Apply Charges" bulk
  // action reads via each created activities row's own flags column,
  // matching the live app's real data flow (Boat Return is the only
  // writer of these flags; diver-form.html never exposes a checkbox).
  const scheduleDiverIds = (diverRows ?? []).map((r) => r.id);
  const { data: tankRows } = scheduleDiverIds.length
    ? await supabase
        .from("schedule_diver_dive_tanks")
        .select("schedule_diver_id, site_index, tank_type")
        .in("schedule_diver_id", scheduleDiverIds)
    : { data: [] };
  const tanksByScheduleDiver = new Map<string, Map<number, string>>();
  for (const t of tankRows ?? []) {
    if (!tanksByScheduleDiver.has(t.schedule_diver_id)) tanksByScheduleDiver.set(t.schedule_diver_id, new Map());
    tanksByScheduleDiver.get(t.schedule_diver_id)!.set(t.site_index, t.tank_type);
  }

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

  // Duplicate-activity guard, matching the live app's "Activities already
  // added" check — a diver can already have an activities row for this
  // date/site (e.g. logged manually via Diver Detail) before Boat Returned
  // is ever clicked. First pass surfaces the conflict for a Proceed/Exclude
  // choice rather than silently double-charging.
  if (!options.forceProceed) {
    const candidateIds = (diverRows ?? []).map((r) => r.diver_id).filter((id) => !excludeSet.has(id));
    if (candidateIds.length > 0) {
      const { data: existing } = await supabase
        .from("activities")
        .select("diver_id")
        .eq("dive_center_id", user.diveCenterId)
        .eq("date", schedule.schedule_date)
        .in("diver_id", candidateIds);
      const dupIds = [...new Set((existing ?? []).map((r) => r.diver_id))];
      if (dupIds.length > 0) {
        const { data: dupDivers } = await supabase
          .from("divers")
          .select("id, first_name, last_name")
          .in("id", dupIds);
        return {
          duplicates: (dupDivers ?? []).map((d) => ({
            diverId: d.id,
            name: `${d.first_name} ${d.last_name}`,
          })),
        };
      }
    }
  }

  const skippedDivers: string[] = [];
  const activityRows: Record<string, unknown>[] = [];

  for (const row of diverRows ?? []) {
    if (excludeSet.has(row.diver_id)) continue;
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
    const diverTanks = tanksByScheduleDiver.get(row.id);

    if (isPackageMode) {
      // One combined row for the whole trip. Per-dive nitrox/15L has no
      // natural single-row slot here — aggregate across every site index
      // for this diver ("nitrox on *any* dive in this package trip"),
      // same "at least one dive uses this tank" semantics schedule_divers.
      // is_15l/nitrox_requested already use elsewhere in this schema.
      const anyNitrox = diverTanks ? [...diverTanks.values()].some((t) => t === "nitrox") : false;
      const any15l = diverTanks ? [...diverTanks.values()].some((t) => t === "air_15l") : false;
      activityRows.push({
        dive_center_id: user.diveCenterId,
        diver_id: row.diver_id,
        visit_id: visit.id,
        schedule_id: scheduleId,
        date: schedule.schedule_date,
        dive_site: siteNames.length > 0 ? siteNames.join(", ") : null,
        staff_name: staffName,
        status: "completed",
        flags: anyNitrox ? { nitrox_requested: true } : any15l ? { tank_15l_requested: true } : null,
      });
    } else {
      const sitesForRow = siteNames.length > 0 ? siteNames : [null];
      sitesForRow.forEach((siteName, siteIndex) => {
        const tankType = diverTanks?.get(siteIndex) ?? null;
        activityRows.push({
          dive_center_id: user.diveCenterId,
          diver_id: row.diver_id,
          visit_id: visit.id,
          schedule_id: scheduleId,
          date: schedule.schedule_date,
          dive_site: siteName,
          staff_name: staffName,
          status: "completed",
          flags:
            tankType === "nitrox"
              ? { nitrox_requested: true }
              : tankType === "air_15l"
                ? { tank_15l_requested: true }
                : null,
        });
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

// Group CRUD moved to the Divers page (src/app/(app)/divers/actions.ts) —
// that's the live app's real home for group management, not Scheduling.

// ── Crew code — moved here from Staff (the live app generates the crew
// code from scheduling.html, not a roster page; staff.html only ever
// reads it). Fresh copy of the same generate_daily_staff_token RPC call
// Staff's own action used, per this codebase's no-cross-page-action-
// imports convention.

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function getCrewTokenToday(): Promise<string | null> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: dc } = await supabase
    .from("dive_centers")
    .select("staff_token, staff_token_date")
    .eq("id", user.diveCenterId)
    .single();
  return dc?.staff_token && dc.staff_token_date === todayManila() ? dc.staff_token : null;
}

export async function generateCrewToken(): Promise<{ error?: string; token?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_daily_staff_token", {
    p_dive_center_id: user.diveCenterId,
  });
  if (error) return { error: error.message };
  return { token: data as string };
}
