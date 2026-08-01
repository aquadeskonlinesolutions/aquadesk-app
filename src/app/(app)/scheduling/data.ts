import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TripTypeDurations } from "./tripWindow";

// Plain calendar-year arithmetic, same as the old app's diverAge() — no
// timezone risk since a birthday is a date-only value with no time
// component to round-trip through a JS Date's local fields.
function calcAge(birthday: string | null): number | null {
  if (!birthday) return null;
  const [y, m, d] = birthday.split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

export type TripSummary = {
  scheduleId: string;
  boatId: string | null;
  boatName: string | null;
  departureTime: string | null;
  isJoiner: boolean;
  joinerBoatName: string | null;
  siteNames: string[];
  diverCount: number;
  closed: boolean;
  cancelled: boolean;
};

export type BoatOption = {
  id: string;
  name: string;
  capacity: number | null;
  fuelType: string | null;
  captain: string | null;
};

export type DiveSiteOption = {
  id: string;
  siteName: string;
};

// Same join-via-Map pattern as boat-manifest/data.ts's siteNamesBySchedule —
// deliberately duplicated per this codebase's established small-helper
// duplication precedent, not shared across pages.
async function siteNamesBySchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scheduleIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (scheduleIds.length === 0) return map;

  const { data: siteRows } = await supabase
    .from("schedule_sites")
    .select("schedule_id, sort_order, dive_sites(site_name)")
    .in("schedule_id", scheduleIds)
    .order("sort_order");

  (siteRows ?? []).forEach((row) => {
    const rel = row.dive_sites as unknown;
    const site = Array.isArray(rel) ? rel[0] : rel;
    const name = (site as { site_name?: string } | null)?.site_name;
    if (!name) return;
    const list = map.get(row.schedule_id) ?? [];
    list.push(name);
    map.set(row.schedule_id, list);
  });
  return map;
}

// Unlike Boat Manifest's loadTripsForDate, this shows every trip (including
// joiner trips) — Scheduling is the day's full picture, not just own-boat
// manifests.
export async function loadTripsForDate(
  diveCenterId: string,
  date: string,
): Promise<TripSummary[]> {
  const supabase = await createClient();

  const [{ data: schedules }, { data: boats }, { data: diverRows }] = await Promise.all([
    supabase
      .from("schedules")
      .select("id, boat_id, departure_time, is_joiner, joiner_boat_name, closed, cancelled")
      .eq("dive_center_id", diveCenterId)
      .eq("schedule_date", date)
      .order("departure_time"),
    supabase.from("boats").select("id, name").eq("dive_center_id", diveCenterId),
    supabase.from("schedule_divers").select("schedule_id").eq("dive_center_id", diveCenterId),
  ]);

  const rows = schedules ?? [];
  const sitesBySchedule = await siteNamesBySchedule(
    supabase,
    rows.map((s) => s.id),
  );
  const boatById = new Map((boats ?? []).map((b) => [b.id, b]));
  const diverCountBySchedule = new Map<string, number>();
  (diverRows ?? []).forEach((r) => {
    diverCountBySchedule.set(r.schedule_id, (diverCountBySchedule.get(r.schedule_id) ?? 0) + 1);
  });

  return rows.map((s) => {
    const boat = s.boat_id ? boatById.get(s.boat_id) : null;
    return {
      scheduleId: s.id,
      boatId: s.boat_id,
      boatName: boat?.name ?? null,
      departureTime: s.departure_time,
      isJoiner: s.is_joiner,
      joinerBoatName: s.joiner_boat_name,
      siteNames: sitesBySchedule.get(s.id) ?? [],
      diverCount: diverCountBySchedule.get(s.id) ?? 0,
      closed: s.closed,
      cancelled: s.cancelled,
    };
  });
}

export async function loadBoatOptions(diveCenterId: string): Promise<BoatOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("boats")
    .select("id, name, capacity, fuel_type, captain")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("name");

  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    capacity: b.capacity,
    fuelType: b.fuel_type,
    captain: b.captain,
  }));
}

export async function loadDiveSiteOptions(diveCenterId: string): Promise<DiveSiteOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dive_sites")
    .select("id, site_name")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("site_name");

  return (data ?? []).map((s) => ({ id: s.id, siteName: s.site_name }));
}

export type TripDetail = {
  scheduleId: string;
  scheduleDate: string;
  boatId: string | null;
  isJoiner: boolean;
  joinerBoatName: string | null;
  departureTime: string | null;
  tripTypeId: string | null;
  captain: string | null;
  crew: string[];
  notes: string | null;
  siteIds: string[];
  fuelConsumedLiters: number | null;
  closed: boolean;
  cancelled: boolean;
  guestDiversCount: number | null;
  guestDiveCenterName: string | null;
  guestNotes: string | null;
  spareTanks: { id: string; tankType: "air_12l" | "air_15l" | "nitrox"; quantity: number }[];
};

export type DiverPickResult = {
  id: string;
  firstName: string;
  lastName: string;
  certificationLevel: string;
  nitroxCertified: boolean;
  nationality: string | null;
  loggedDives: number;
  age: number | null;
  groupId: string | null;
  groupName: string | null;
  openVisitId: string | null;
  openVisitExperienceType: "fun_diving" | "dive_course" | null;
  alreadyScheduledToday: boolean;
  suggestedStaffId: string | null;
};

async function buildDiverPickResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  diverIds: string[],
  scheduleDate: string,
  excludeScheduleId: string | null,
): Promise<DiverPickResult[]> {
  if (diverIds.length === 0) return [];

  const [{ data: divers }, { data: visits }, { data: defaults }, { data: scheduledToday }] =
    await Promise.all([
      supabase
        .from("divers")
        .select(
          "id, first_name, last_name, certification_level, nitrox_certified, nationality, logged_dives, birthday, group_id",
        )
        .in("id", diverIds),
      supabase
        .from("visits")
        .select("id, diver_id, experience_type, created_at")
        .in("diver_id", diverIds)
        .eq("is_active", true)
        .eq("visit_status", "open")
        .order("created_at", { ascending: false }),
      supabase
        .from("diver_staff_defaults")
        .select("diver_id, staff_id")
        .eq("dive_center_id", diveCenterId)
        .in("diver_id", diverIds),
      supabase
        .from("schedule_divers")
        .select("diver_id, schedule_id, schedules!inner(schedule_date)")
        .in("diver_id", diverIds)
        .eq("dive_center_id", diveCenterId)
        .eq("schedules.schedule_date", scheduleDate),
    ]);

  const groupIds = [...new Set((divers ?? []).map((d) => d.group_id).filter(Boolean))] as string[];
  const { data: groups } = groupIds.length
    ? await supabase.from("groups").select("id, group_name").in("id", groupIds)
    : { data: [] };
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.group_name]));

  const openVisitByDiver = new Map<string, { id: string; experienceType: string }>();
  (visits ?? []).forEach((v) => {
    if (!openVisitByDiver.has(v.diver_id)) {
      openVisitByDiver.set(v.diver_id, { id: v.id, experienceType: v.experience_type });
    }
  });

  const defaultStaffByDiver = new Map((defaults ?? []).map((d) => [d.diver_id, d.staff_id]));

  const scheduledTodayIds = new Set(
    (scheduledToday ?? [])
      .filter((r) => !excludeScheduleId || r.schedule_id !== excludeScheduleId)
      .map((r) => r.diver_id),
  );

  return (divers ?? []).map((d) => {
    const visit = openVisitByDiver.get(d.id);
    return {
      id: d.id,
      firstName: d.first_name,
      lastName: d.last_name,
      certificationLevel: d.certification_level,
      nitroxCertified: d.nitrox_certified,
      nationality: d.nationality,
      loggedDives: d.logged_dives ?? 0,
      age: calcAge(d.birthday),
      groupId: d.group_id,
      groupName: d.group_id ? groupNameById.get(d.group_id) ?? null : null,
      openVisitId: visit?.id ?? null,
      openVisitExperienceType: (visit?.experienceType as "fun_diving" | "dive_course") ?? null,
      alreadyScheduledToday: scheduledTodayIds.has(d.id),
      suggestedStaffId: defaultStaffByDiver.get(d.id) ?? null,
    };
  });
}

export type DiveTank = { siteIndex: number; tankType: "nitrox" | "air_15l" };

export type ScheduleDiverRow = {
  diverId: string;
  firstName: string;
  lastName: string;
  certificationLevel: string;
  nitroxCertified: boolean;
  staffId: string | null;
  staffName: string | null;
  sourceClipId: string | null;
  experienceType: "fun_diving" | "dive_course" | null;
  courseName: string | null;
  is15L: boolean;
  nitroxRequested: boolean;
  tanks: DiveTank[];
};

export async function loadScheduleDivers(
  diveCenterId: string,
  scheduleId: string,
): Promise<ScheduleDiverRow[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("schedule_divers")
    .select("id, diver_id, staff_id, staff_name, source_clip_id, experience_type, is_15l, nitrox_requested")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_id", scheduleId);

  const diverIds = (rows ?? []).map((r) => r.diver_id);
  if (diverIds.length === 0) return [];

  const scheduleDiverIds = (rows ?? []).map((r) => r.id);
  const [{ data: divers }, { data: tankRows }, { data: openVisits }] = await Promise.all([
    supabase
      .from("divers")
      .select("id, first_name, last_name, certification_level, nitrox_certified")
      .in("id", diverIds),
    supabase
      .from("schedule_diver_dive_tanks")
      .select("schedule_diver_id, site_index, tank_type")
      .in("schedule_diver_id", scheduleDiverIds),
    supabase
      .from("visits")
      .select("diver_id, course_rate_id, created_at")
      .in("diver_id", diverIds)
      .eq("is_active", true)
      .eq("visit_status", "open")
      .order("created_at", { ascending: false }),
  ]);
  const diverById = new Map((divers ?? []).map((d) => [d.id, d]));
  const tanksByScheduleDiverId = new Map<string, DiveTank[]>();
  (tankRows ?? []).forEach((t) => {
    const list = tanksByScheduleDiverId.get(t.schedule_diver_id) ?? [];
    list.push({ siteIndex: t.site_index, tankType: t.tank_type as "nitrox" | "air_15l" });
    tanksByScheduleDiverId.set(t.schedule_diver_id, list);
  });
  const courseRateIdByDiver = new Map<string, string>();
  (openVisits ?? []).forEach((v) => {
    if (!courseRateIdByDiver.has(v.diver_id) && v.course_rate_id) {
      courseRateIdByDiver.set(v.diver_id, v.course_rate_id);
    }
  });
  const courseRateIds = [...new Set(courseRateIdByDiver.values())];
  const { data: courseRates } = courseRateIds.length
    ? await supabase.from("course_rates").select("id, course_name").in("id", courseRateIds)
    : { data: [] };
  const courseNameById = new Map((courseRates ?? []).map((c) => [c.id, c.course_name]));

  return (rows ?? []).flatMap((r) => {
    const d = diverById.get(r.diver_id);
    if (!d) return [];
    const courseRateId = courseRateIdByDiver.get(r.diver_id);
    return [
      {
        diverId: r.diver_id,
        firstName: d.first_name,
        lastName: d.last_name,
        certificationLevel: d.certification_level,
        nitroxCertified: d.nitrox_certified,
        staffId: r.staff_id,
        staffName: r.staff_name,
        sourceClipId: r.source_clip_id,
        experienceType: r.experience_type,
        courseName: courseRateId ? (courseNameById.get(courseRateId) ?? null) : null,
        is15L: r.is_15l,
        nitroxRequested: r.nitrox_requested,
        tanks: tanksByScheduleDiverId.get(r.id) ?? [],
      },
    ];
  });
}

export type StaffDiveTanks = { staffName: string; siteIndexes: number[] };

export async function loadStaffDiveTanks(
  diveCenterId: string,
  scheduleId: string,
): Promise<StaffDiveTanks[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_staff_dive_tanks")
    .select("staff_name, site_index")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_id", scheduleId);

  const bySite = new Map<string, number[]>();
  (data ?? []).forEach((r) => {
    const list = bySite.get(r.staff_name) ?? [];
    list.push(r.site_index);
    bySite.set(r.staff_name, list);
  });
  return [...bySite.entries()].map(([staffName, siteIndexes]) => ({ staffName, siteIndexes }));
}

// All clips for a date (feeds Phase 2's "+ Add Team" picker — the caller
// filters out members already placed on the trip card being edited, purely
// client-side, since a brand-new unsaved trip has no schedule_id yet to
// query placement against).
export async function loadClipsForDate(diveCenterId: string, scheduleDate: string): Promise<Clip[]> {
  const supabase = await createClient();
  return fetchClipsRaw(supabase, diveCenterId, scheduleDate);
}

export type StaffOption = { id: string; fullName: string; position: string };

export async function loadStaffOptions(diveCenterId: string): Promise<StaffOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, first_name, last_name, position")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("first_name");

  return (data ?? []).map((s) => ({
    id: s.id,
    fullName: `${s.first_name} ${s.last_name}`,
    position: s.position,
  }));
}

export type TripTypeOption = { id: string; name: string; durations: TripTypeDurations };

export async function loadTripTypeOptions(diveCenterId: string): Promise<TripTypeOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_types")
    .select("id, name, travel_out_minutes, travel_back_minutes, dive_minutes, surface_interval_minutes")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("name");

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    durations: {
      travelOutMinutes: t.travel_out_minutes,
      travelBackMinutes: t.travel_back_minutes,
      diveMinutes: t.dive_minutes,
      surfaceIntervalMinutes: t.surface_interval_minutes,
    },
  }));
}

// scheduleId is included so each TripCard can filter out its own
// assignments client-side — a shared whole-day fetch (one query) rather
// than a separate excluded-self query per card, but still avoiding the
// "warns about double-booking against itself" bug that a naive whole-day
// list (with no way to identify which trip a row belongs to) would cause.
export type DayAssignment = {
  diverId: string;
  staffId: string | null;
  boatId: string | null;
  scheduleId: string;
  departureTime: string | null;
  diveCount: number;
  tripTypeDurations: TripTypeDurations | null;
};

export async function loadDayAssignmentsForWarnings(
  diveCenterId: string,
  scheduleDate: string,
): Promise<DayAssignment[]> {
  const supabase = await createClient();

  const { data: schedules } = await supabase
    .from("schedules")
    .select("id, boat_id, departure_time, trip_type_id")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_date", scheduleDate)
    .eq("cancelled", false);

  const scheduleIds = (schedules ?? []).map((s) => s.id);
  if (scheduleIds.length === 0) return [];

  const tripTypeIds = [...new Set((schedules ?? []).map((s) => s.trip_type_id).filter(Boolean))] as string[];
  const [{ data: siteRows }, { data: tripTypeRows }] = await Promise.all([
    supabase.from("schedule_sites").select("schedule_id").in("schedule_id", scheduleIds),
    tripTypeIds.length
      ? supabase
          .from("trip_types")
          .select("id, travel_out_minutes, travel_back_minutes, dive_minutes, surface_interval_minutes")
          .in("id", tripTypeIds)
      : Promise.resolve({ data: [] as { id: string; travel_out_minutes: number; travel_back_minutes: number; dive_minutes: number; surface_interval_minutes: number }[] }),
  ]);

  const diveCountByScheduleId = new Map<string, number>();
  (siteRows ?? []).forEach((r) => {
    diveCountByScheduleId.set(r.schedule_id, (diveCountByScheduleId.get(r.schedule_id) ?? 0) + 1);
  });
  const durationsByTripTypeId = new Map(
    (tripTypeRows ?? []).map((t) => [
      t.id,
      {
        travelOutMinutes: t.travel_out_minutes,
        travelBackMinutes: t.travel_back_minutes,
        diveMinutes: t.dive_minutes,
        surfaceIntervalMinutes: t.surface_interval_minutes,
      } as TripTypeDurations,
    ]),
  );

  const boatByScheduleId = new Map((schedules ?? []).map((s) => [s.id, s.boat_id]));
  const departureByScheduleId = new Map((schedules ?? []).map((s) => [s.id, s.departure_time]));
  const durationsForSchedule = new Map(
    (schedules ?? []).map((s) => [s.id, s.trip_type_id ? durationsByTripTypeId.get(s.trip_type_id) ?? null : null]),
  );

  const { data: rows } = await supabase
    .from("schedule_divers")
    .select("diver_id, staff_id, schedule_id")
    .in("schedule_id", scheduleIds);

  return (rows ?? []).map((r) => ({
    diverId: r.diver_id,
    staffId: r.staff_id,
    boatId: boatByScheduleId.get(r.schedule_id) ?? null,
    scheduleId: r.schedule_id,
    departureTime: departureByScheduleId.get(r.schedule_id) ?? null,
    diveCount: diveCountByScheduleId.get(r.schedule_id) ?? 0,
    tripTypeDurations: durationsForSchedule.get(r.schedule_id) ?? null,
  }));
}

// Every diver with an open, unpaid visit today, not yet assigned to this
// trip — the real "readiness" signal (see the Divers page's push-to-
// schedule action). Matches the live app's card-grid pool
// (divers.html/scheduling.html's phaseOneLooseDivers), shown alongside
// the existing name search rather than replacing it.
export async function loadReadyPool(
  diveCenterId: string,
  scheduleDate: string,
  excludeScheduleId: string | null,
): Promise<DiverPickResult[]> {
  const supabase = await createClient();
  const { data: openVisits } = await supabase
    .from("visits")
    .select("diver_id")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .eq("visit_status", "open")
    .eq("is_paid", false);

  const diverIds = [...new Set((openVisits ?? []).map((v) => v.diver_id))];
  return buildDiverPickResults(supabase, diveCenterId, diverIds, scheduleDate, excludeScheduleId);
}

// ── Phase 1: loose divers + suggested team clips ──────────────────────────
// Mirrors scheduling.html's Phase 1 exactly: a "clip" is a saved staff +
// diver(s) grouping (schedule_team_clips/schedule_team_clip_divers, both
// already RLS'd from Stage 1a, unused by any writer until now). Loose
// divers = the ready pool (open+unpaid visit today) minus anyone already
// clipped, excluded for the day, or already assigned to a trip today.

export type ClipMember = {
  diverId: string;
  firstName: string;
  lastName: string;
  certificationLevel: string;
  nitroxCertified: boolean;
  nationality: string | null;
  loggedDives: number;
  age: number | null;
  groupId: string | null;
  groupName: string | null;
  excluded: boolean;
  experienceType: "fun_diving" | "dive_course" | null;
  courseName: string | null;
};

export type Clip = {
  id: string;
  staffId: string | null;
  staffName: string;
  isFreelancer: boolean;
  source: "manual" | "returned" | "carryover";
  carryForward: boolean;
  members: ClipMember[];
};

// Mirrors scheduling.html's real findExistingStaffClip() — the live app
// doesn't block clipping the same staff member twice, it merges the two
// clips into one (a confirm modal on create, a background consolidation
// pass on every render). This rebuild does the merge as a real DB write at
// clip-creation/staff-edit time instead of an in-memory consolidation pass,
// since every clip write already goes through these two actions.
export async function findMatchingClip(
  diveCenterId: string,
  scheduleDate: string,
  staffId: string | null,
  staffName: string,
  isFreelancer: boolean,
  excludeClipId?: string,
): Promise<string | null> {
  const supabase = await createClient();
  let query = supabase
    .from("schedule_team_clips")
    .select("id, staff_id, staff_name, is_freelancer")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_date", scheduleDate);
  if (excludeClipId) query = query.neq("id", excludeClipId);
  const { data: clips } = await query;

  const nameKey = staffName.trim().toLowerCase();
  const match = (clips ?? []).find((c) =>
    isFreelancer || !staffId
      ? c.is_freelancer && c.staff_name.trim().toLowerCase() === nameKey
      : !c.is_freelancer && c.staff_id === staffId,
  );
  return match?.id ?? null;
}

export async function loadExcludedDiverIds(diveCenterId: string, date: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_day_diver_exclusions")
    .select("diver_id")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_date", date);
  return new Set((data ?? []).map((r) => r.diver_id));
}

async function fetchClipsRaw(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  date: string,
): Promise<Clip[]> {
  const { data: clipRows } = await supabase
    .from("schedule_team_clips")
    .select("id, staff_id, staff_name, is_freelancer, source, carry_forward")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_date", date)
    .order("created_at");
  if (!clipRows || clipRows.length === 0) return [];

  const clipIds = clipRows.map((c) => c.id);
  const { data: memberRows } = await supabase
    .from("schedule_team_clip_divers")
    .select("clip_id, diver_id, excluded_on_date")
    .in("clip_id", clipIds);

  const diverIds = [...new Set((memberRows ?? []).map((m) => m.diver_id))];
  const { data: divers } = diverIds.length
    ? await supabase
        .from("divers")
        .select(
          "id, first_name, last_name, certification_level, nitrox_certified, nationality, logged_dives, birthday, group_id",
        )
        .in("id", diverIds)
    : { data: [] };
  const groupIds = [...new Set((divers ?? []).map((d) => d.group_id).filter(Boolean))] as string[];
  const { data: groups } = groupIds.length
    ? await supabase.from("groups").select("id, group_name").in("id", groupIds)
    : { data: [] };
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.group_name]));
  const diverById = new Map((divers ?? []).map((d) => [d.id, d]));

  // A clip member's experience type isn't stored on the clip itself — it
  // comes from the diver's current open visit (the same value push-to-
  // schedule tagged) so it can be carried onto schedule_divers when the
  // clip is assigned to a trip. /staff's get_crew_schedule RPC reads
  // schedule_divers.experience_type directly, so this has to be threaded
  // through all the way to the save, not just displayed here.
  const { data: openVisits } = diverIds.length
    ? await supabase
        .from("visits")
        .select("diver_id, experience_type, course_rate_id, created_at")
        .in("diver_id", diverIds)
        .eq("is_active", true)
        .eq("visit_status", "open")
        .order("created_at", { ascending: false })
    : { data: [] };
  const experienceTypeByDiver = new Map<string, "fun_diving" | "dive_course">();
  const courseRateIdByDiver = new Map<string, string>();
  (openVisits ?? []).forEach((v) => {
    if (!experienceTypeByDiver.has(v.diver_id)) {
      experienceTypeByDiver.set(v.diver_id, v.experience_type as "fun_diving" | "dive_course");
      if (v.course_rate_id) courseRateIdByDiver.set(v.diver_id, v.course_rate_id);
    }
  });

  const courseRateIds = [...new Set(courseRateIdByDiver.values())];
  const { data: courseRates } = courseRateIds.length
    ? await supabase.from("course_rates").select("id, course_name").in("id", courseRateIds)
    : { data: [] };
  const courseNameById = new Map((courseRates ?? []).map((c) => [c.id, c.course_name]));

  const membersByClip = new Map<string, ClipMember[]>();
  (memberRows ?? []).forEach((m) => {
    const d = diverById.get(m.diver_id);
    if (!d) return;
    const list = membersByClip.get(m.clip_id) ?? [];
    const courseRateId = courseRateIdByDiver.get(d.id);
    list.push({
      diverId: d.id,
      firstName: d.first_name,
      lastName: d.last_name,
      certificationLevel: d.certification_level,
      nitroxCertified: d.nitrox_certified,
      nationality: d.nationality,
      loggedDives: d.logged_dives ?? 0,
      age: calcAge(d.birthday),
      groupId: d.group_id,
      groupName: d.group_id ? (groupNameById.get(d.group_id) ?? null) : null,
      excluded: m.excluded_on_date,
      experienceType: experienceTypeByDiver.get(d.id) ?? null,
      courseName: courseRateId ? (courseNameById.get(courseRateId) ?? null) : null,
    });
    membersByClip.set(m.clip_id, list);
  });

  return clipRows.map((c) => ({
    id: c.id,
    staffId: c.staff_id,
    staffName: c.staff_name,
    isFreelancer: c.is_freelancer,
    source: c.source as Clip["source"],
    carryForward: c.carry_forward,
    members: membersByClip.get(c.id) ?? [],
  }));
}

// Real write-back, matching scheduling.html's carryOverLatestSharedClips —
// looks back (bounded, like the live app's 80-row limit) for the most
// recent earlier date with carry-forward-eligible clips and copies that
// whole date's clips forward, dropping any diver no longer schedulable
// (no open, unpaid visit today).
async function carryOverLatestSharedClips(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  date: string,
  userId: string,
): Promise<void> {
  const { data: prior } = await supabase
    .from("schedule_team_clips")
    .select("id, schedule_date, staff_id, staff_name, is_freelancer")
    .eq("dive_center_id", diveCenterId)
    .lt("schedule_date", date)
    .neq("carry_forward", false)
    .order("schedule_date", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(80);
  if (!prior || prior.length === 0) return;

  const latestDate = prior[0].schedule_date;
  const sourceClips = prior.filter((c) => c.schedule_date === latestDate);
  const sourceClipIds = sourceClips.map((c) => c.id);

  const { data: sourceMembers } = await supabase
    .from("schedule_team_clip_divers")
    .select("clip_id, diver_id")
    .in("clip_id", sourceClipIds)
    .eq("excluded_on_date", false);

  const memberDiverIds = [...new Set((sourceMembers ?? []).map((m) => m.diver_id))];
  const { data: openVisitRows } = memberDiverIds.length
    ? await supabase
        .from("visits")
        .select("diver_id")
        .eq("dive_center_id", diveCenterId)
        .eq("is_active", true)
        .eq("visit_status", "open")
        .eq("is_paid", false)
        .in("diver_id", memberDiverIds)
    : { data: [] };
  const stillSchedulable = new Set((openVisitRows ?? []).map((r) => r.diver_id));

  for (const c of sourceClips) {
    const members = (sourceMembers ?? []).filter((m) => m.clip_id === c.id && stillSchedulable.has(m.diver_id));
    if (members.length === 0) continue;

    const { data: newClip } = await supabase
      .from("schedule_team_clips")
      .insert({
        dive_center_id: diveCenterId,
        schedule_date: date,
        staff_id: c.staff_id,
        staff_name: c.staff_name,
        is_freelancer: c.is_freelancer,
        source: "carryover",
        carry_forward: true,
        created_by: userId,
      })
      .select("id")
      .single();
    if (!newClip) continue;

    await supabase.from("schedule_team_clip_divers").insert(
      members.map((m) => ({
        dive_center_id: diveCenterId,
        clip_id: newClip.id,
        diver_id: m.diver_id,
        excluded_on_date: false,
      })),
    );
  }
}

export type PhaseOneData = {
  clips: Clip[];
  looseDivers: DiverPickResult[];
  excludedDivers: DiverPickResult[];
};

export async function loadPhaseOneData(diveCenterId: string, date: string, userId: string): Promise<PhaseOneData> {
  const supabase = await createClient();

  let clips = await fetchClipsRaw(supabase, diveCenterId, date);
  if (clips.length === 0) {
    await carryOverLatestSharedClips(supabase, diveCenterId, date, userId);
    clips = await fetchClipsRaw(supabase, diveCenterId, date);
  }

  const excludedSet = await loadExcludedDiverIds(diveCenterId, date);
  const readyPool = await loadReadyPool(diveCenterId, date, null);
  // A diver excluded from a clip (excluded_on_date) stays "handled" by
  // that clip — they must not fall back into the loose pool, matching
  // scheduling.html's allClipDiverIds(), which is unfiltered by exclusion.
  const clippedIds = new Set(clips.flatMap((c) => c.members.map((m) => m.diverId)));
  const looseDivers = readyPool.filter(
    (d) => !clippedIds.has(d.id) && !excludedSet.has(d.id) && !d.alreadyScheduledToday,
  );
  const excludedDivers = readyPool.filter((d) => excludedSet.has(d.id));

  return { clips, looseDivers, excludedDivers };
}

export async function loadTripDetail(
  diveCenterId: string,
  scheduleId: string,
): Promise<TripDetail | null> {
  const supabase = await createClient();

  const { data: schedule } = await supabase
    .from("schedules")
    .select(
      "id, schedule_date, boat_id, is_joiner, joiner_boat_name, departure_time, trip_type_id, captain, notes, fuel_consumed_liters, closed, cancelled, guest_divers_count, guest_dive_center_name, guest_notes",
    )
    .eq("id", scheduleId)
    .eq("dive_center_id", diveCenterId)
    .single();
  if (!schedule) return null;

  const [{ data: siteRows }, { data: crewRows }, { data: spareTankRows }] = await Promise.all([
    supabase.from("schedule_sites").select("dive_site_id").eq("schedule_id", scheduleId).order("sort_order"),
    supabase.from("schedule_crew").select("crew_name").eq("schedule_id", scheduleId).order("sort_order"),
    supabase.from("schedule_spare_tanks").select("id, tank_type, quantity").eq("schedule_id", scheduleId).order("sort_order"),
  ]);

  return {
    scheduleId: schedule.id,
    scheduleDate: schedule.schedule_date,
    boatId: schedule.boat_id,
    isJoiner: schedule.is_joiner,
    joinerBoatName: schedule.joiner_boat_name,
    departureTime: schedule.departure_time,
    tripTypeId: schedule.trip_type_id,
    captain: schedule.captain,
    crew: (crewRows ?? []).map((r) => r.crew_name),
    notes: schedule.notes,
    siteIds: (siteRows ?? []).map((r) => r.dive_site_id),
    fuelConsumedLiters: schedule.fuel_consumed_liters,
    closed: schedule.closed,
    cancelled: schedule.cancelled,
    guestDiversCount: schedule.guest_divers_count,
    guestDiveCenterName: schedule.guest_dive_center_name,
    guestNotes: schedule.guest_notes,
    spareTanks: (spareTankRows ?? []).map((r) => ({ id: r.id, tankType: r.tank_type, quantity: r.quantity })),
  };
}
