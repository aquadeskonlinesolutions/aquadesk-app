import "server-only";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, name, capacity, fuel_type")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("name");

  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    capacity: b.capacity,
    fuelType: b.fuel_type,
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
  notes: string | null;
  siteIds: string[];
  fuelConsumedLiters: number | null;
  closed: boolean;
  cancelled: boolean;
  guestDiversCount: number | null;
  guestDiveCenterName: string | null;
  guestNotes: string | null;
};

export type DiverPickResult = {
  id: string;
  firstName: string;
  lastName: string;
  certificationLevel: string;
  nitroxCertified: boolean;
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
        .select("id, first_name, last_name, certification_level, nitrox_certified, group_id")
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
      groupId: d.group_id,
      groupName: d.group_id ? groupNameById.get(d.group_id) ?? null : null,
      openVisitId: visit?.id ?? null,
      openVisitExperienceType: (visit?.experienceType as "fun_diving" | "dive_course") ?? null,
      alreadyScheduledToday: scheduledTodayIds.has(d.id),
      suggestedStaffId: defaultStaffByDiver.get(d.id) ?? null,
    };
  });
}

export async function searchDiversForAssignment(
  diveCenterId: string,
  query: string,
  scheduleDate: string,
  excludeScheduleId: string | null,
): Promise<DiverPickResult[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("divers")
    .select("id")
    .eq("dive_center_id", diveCenterId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .limit(20);

  return buildDiverPickResults(
    supabase,
    diveCenterId,
    (data ?? []).map((d) => d.id),
    scheduleDate,
    excludeScheduleId,
  );
}

export type GroupOption = { id: string; groupName: string; memberCount: number };

export async function loadActiveGroups(diveCenterId: string): Promise<GroupOption[]> {
  const supabase = await createClient();
  const { data: groups } = await supabase
    .from("groups")
    .select("id, group_name")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("group_name");

  const { data: members } = await supabase
    .from("divers")
    .select("group_id")
    .eq("dive_center_id", diveCenterId)
    .not("group_id", "is", null);

  const countByGroup = new Map<string, number>();
  (members ?? []).forEach((m) => {
    if (!m.group_id) return;
    countByGroup.set(m.group_id, (countByGroup.get(m.group_id) ?? 0) + 1);
  });

  return (groups ?? []).map((g) => ({
    id: g.id,
    groupName: g.group_name,
    memberCount: countByGroup.get(g.id) ?? 0,
  }));
}

export async function loadGroupMembersForAssignment(
  diveCenterId: string,
  groupId: string,
  scheduleDate: string,
  excludeScheduleId: string | null,
): Promise<DiverPickResult[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("divers").select("id").eq("group_id", groupId);
  return buildDiverPickResults(
    supabase,
    diveCenterId,
    (data ?? []).map((d) => d.id),
    scheduleDate,
    excludeScheduleId,
  );
}

export type ScheduleDiverRow = {
  diverId: string;
  firstName: string;
  lastName: string;
  certificationLevel: string;
  nitroxCertified: boolean;
  staffId: string | null;
  experienceType: "fun_diving" | "dive_course" | null;
  is15L: boolean;
  nitroxRequested: boolean;
};

export async function loadScheduleDivers(
  diveCenterId: string,
  scheduleId: string,
): Promise<ScheduleDiverRow[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("schedule_divers")
    .select("diver_id, staff_id, experience_type, is_15l, nitrox_requested")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_id", scheduleId);

  const diverIds = (rows ?? []).map((r) => r.diver_id);
  if (diverIds.length === 0) return [];

  const { data: divers } = await supabase
    .from("divers")
    .select("id, first_name, last_name, certification_level, nitrox_certified")
    .in("id", diverIds);
  const diverById = new Map((divers ?? []).map((d) => [d.id, d]));

  return (rows ?? []).flatMap((r) => {
    const d = diverById.get(r.diver_id);
    if (!d) return [];
    return [
      {
        diverId: r.diver_id,
        firstName: d.first_name,
        lastName: d.last_name,
        certificationLevel: d.certification_level,
        nitroxCertified: d.nitrox_certified,
        staffId: r.staff_id,
        experienceType: r.experience_type,
        is15L: r.is_15l,
        nitroxRequested: r.nitrox_requested,
      },
    ];
  });
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

export type CourseRateOption = { id: string; courseName: string; rate: number };

export async function loadCourseRateOptions(diveCenterId: string): Promise<CourseRateOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_rates")
    .select("id, course_name, rate")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("course_name");

  return (data ?? []).map((c) => ({ id: c.id, courseName: c.course_name, rate: Number(c.rate) }));
}

export type DayAssignment = { diverId: string; staffId: string | null; boatId: string | null };

export async function loadDayAssignmentsForWarnings(
  diveCenterId: string,
  scheduleDate: string,
  excludeScheduleId: string | null,
): Promise<DayAssignment[]> {
  const supabase = await createClient();

  const { data: schedules } = await supabase
    .from("schedules")
    .select("id, boat_id")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_date", scheduleDate)
    .eq("cancelled", false);

  const otherScheduleIds = (schedules ?? [])
    .filter((s) => !excludeScheduleId || s.id !== excludeScheduleId)
    .map((s) => s.id);
  if (otherScheduleIds.length === 0) return [];

  const boatByScheduleId = new Map((schedules ?? []).map((s) => [s.id, s.boat_id]));

  const { data: rows } = await supabase
    .from("schedule_divers")
    .select("diver_id, staff_id, schedule_id")
    .in("schedule_id", otherScheduleIds);

  return (rows ?? []).map((r) => ({
    diverId: r.diver_id,
    staffId: r.staff_id,
    boatId: boatByScheduleId.get(r.schedule_id) ?? null,
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

export async function loadTripDetail(
  diveCenterId: string,
  scheduleId: string,
): Promise<TripDetail | null> {
  const supabase = await createClient();

  const { data: schedule } = await supabase
    .from("schedules")
    .select(
      "id, schedule_date, boat_id, is_joiner, joiner_boat_name, departure_time, notes, fuel_consumed_liters, closed, cancelled, guest_divers_count, guest_dive_center_name, guest_notes",
    )
    .eq("id", scheduleId)
    .eq("dive_center_id", diveCenterId)
    .single();
  if (!schedule) return null;

  const { data: siteRows } = await supabase
    .from("schedule_sites")
    .select("dive_site_id")
    .eq("schedule_id", scheduleId)
    .order("sort_order");

  return {
    scheduleId: schedule.id,
    scheduleDate: schedule.schedule_date,
    boatId: schedule.boat_id,
    isJoiner: schedule.is_joiner,
    joinerBoatName: schedule.joiner_boat_name,
    departureTime: schedule.departure_time,
    notes: schedule.notes,
    siteIds: (siteRows ?? []).map((r) => r.dive_site_id),
    fuelConsumedLiters: schedule.fuel_consumed_liters,
    closed: schedule.closed,
    cancelled: schedule.cancelled,
    guestDiversCount: schedule.guest_divers_count,
    guestDiveCenterName: schedule.guest_dive_center_name,
    guestNotes: schedule.guest_notes,
  };
}
