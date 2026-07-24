import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TripOption = {
  scheduleId: string;
  boatName: string;
  siteLabel: string;
  departureTime: string | null;
  hasManifestEdits: boolean;
};

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

export async function loadTripsForDate(
  diveCenterId: string,
  date: string,
): Promise<TripOption[]> {
  const supabase = await createClient();

  const [{ data: schedules }, { data: boats }, { data: manifests }] = await Promise.all([
    supabase
      .from("schedules")
      .select("id, boat_id, departure_time")
      .eq("dive_center_id", diveCenterId)
      .eq("schedule_date", date)
      .eq("is_joiner", false)
      .order("departure_time"),
    supabase.from("boats").select("id, name").eq("dive_center_id", diveCenterId),
    supabase
      .from("manifests")
      .select("schedule_id, district, port")
      .eq("dive_center_id", diveCenterId),
  ]);

  const rows = schedules ?? [];
  const sitesBySchedule = await siteNamesBySchedule(
    supabase,
    rows.map((s) => s.id),
  );
  const boatById = new Map((boats ?? []).map((b) => [b.id, b]));
  const manifestBySchedule = new Map((manifests ?? []).map((m) => [m.schedule_id, m]));

  return rows.map((s) => {
    const boat = s.boat_id ? boatById.get(s.boat_id) : null;
    const siteNames = sitesBySchedule.get(s.id);
    return {
      scheduleId: s.id,
      boatName: boat?.name ?? "Unknown Boat",
      siteLabel: siteNames?.length ? siteNames.join(", ") : "No sites",
      departureTime: s.departure_time,
      hasManifestEdits: !!(
        manifestBySchedule.get(s.id)?.district || manifestBySchedule.get(s.id)?.port
      ),
    };
  });
}

export type ManifestPassenger = {
  diverId: string;
  fullName: string;
  age: number | null;
  nationality: string | null;
  residence: string | null;
};

export type ManifestDetail = {
  scheduleId: string;
  scheduleDate: string;
  boatName: string;
  captain: string | null;
  siteLabel: string;
  district: string;
  port: string;
  passengers: ManifestPassenger[];
};

function calcAge(birthday: string | null): number | null {
  if (!birthday) return null;
  const b = new Date(`${birthday}T00:00:00`);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const monthDiff = now.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

export async function loadManifestDetail(
  diveCenterId: string,
  scheduleId: string,
): Promise<ManifestDetail | null> {
  const supabase = await createClient();

  const { data: schedule } = await supabase
    .from("schedules")
    .select("id, boat_id, schedule_date")
    .eq("id", scheduleId)
    .eq("dive_center_id", diveCenterId)
    .single();
  if (!schedule) return null;

  const [{ data: boat }, sitesBySchedule, { data: scheduleDivers }, { data: manifest }] =
    await Promise.all([
      schedule.boat_id
        ? supabase
            .from("boats")
            .select("name, captain")
            .eq("id", schedule.boat_id)
            .single()
        : Promise.resolve({ data: null }),
      siteNamesBySchedule(supabase, [scheduleId]),
      supabase.from("schedule_divers").select("diver_id").eq("schedule_id", scheduleId),
      supabase
        .from("manifests")
        .select("district, port")
        .eq("schedule_id", scheduleId)
        .eq("dive_center_id", diveCenterId)
        .maybeSingle(),
    ]);

  const diverIds = [...new Set((scheduleDivers ?? []).map((r) => r.diver_id))];

  const [{ data: divers }, { data: registrations }] = await Promise.all([
    diverIds.length
      ? supabase
          .from("divers")
          .select("id, first_name, last_name, birthday, nationality")
          .in("id", diverIds)
      : Promise.resolve({ data: [] }),
    diverIds.length
      ? supabase
          .from("diver_registrations")
          .select("diver_id, accommodation, created_at")
          .in("diver_id", diverIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // Most recent registration per diver — registrations are pre-sorted newest
  // first, so the first match for each diver_id is the latest one.
  const latestAccommodation = new Map<string, string | null>();
  (registrations ?? []).forEach((r) => {
    if (!latestAccommodation.has(r.diver_id)) {
      latestAccommodation.set(r.diver_id, r.accommodation);
    }
  });

  const passengers: ManifestPassenger[] = (divers ?? []).map((d) => ({
    diverId: d.id,
    fullName: `${d.first_name} ${d.last_name}`.trim(),
    age: calcAge(d.birthday),
    nationality: d.nationality,
    residence: latestAccommodation.get(d.id) ?? null,
  }));

  const siteNames = sitesBySchedule.get(scheduleId);

  return {
    scheduleId,
    scheduleDate: schedule.schedule_date,
    boatName: boat?.name ?? "Unknown Boat",
    captain: boat?.captain ?? null,
    siteLabel: siteNames?.length ? siteNames.join(", ") : "________",
    district: manifest?.district ?? "",
    port: manifest?.port ?? "",
    passengers,
  };
}
