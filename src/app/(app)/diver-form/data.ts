import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DiverListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  accommodation: string | null;
  certificationLevel: string;
  latestArrivalDate: string | null;
  latestDepartureDate: string | null;
};

// arrival/departure dates live only on diver_registrations now (a diver's
// evergreen profile on `divers` has no current-stay concept) — resolved per
// diver via a second query and merged with a Map, same join-via-Map pattern
// already used throughout reports/data.ts.
async function attachLatestArrival(
  diveCenterId: string,
  rows: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    accommodation: string | null;
    certification_level: string;
  }[],
): Promise<DiverListItem[]> {
  const supabase = await createClient();
  const diverIds = rows.map((r) => r.id);

  const { data: registrations } = diverIds.length
    ? await supabase
        .from("diver_registrations")
        .select("diver_id, arrival_date, departure_date, created_at")
        .eq("dive_center_id", diveCenterId)
        .in("diver_id", diverIds)
        .order("created_at", { ascending: false })
    : { data: [] as { diver_id: string; arrival_date: string | null; departure_date: string | null; created_at: string }[] };

  const arrivalMap = new Map<string, string | null>();
  const departureMap = new Map<string, string | null>();
  (registrations ?? []).forEach((r) => {
    if (!arrivalMap.has(r.diver_id)) {
      arrivalMap.set(r.diver_id, r.arrival_date);
      departureMap.set(r.diver_id, r.departure_date);
    }
  });

  return rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    whatsapp: r.whatsapp,
    accommodation: r.accommodation,
    certificationLevel: r.certification_level,
    latestArrivalDate: arrivalMap.get(r.id) ?? null,
    latestDepartureDate: departureMap.get(r.id) ?? null,
  }));
}

export async function loadRecentDivers(diveCenterId: string): Promise<DiverListItem[]> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("divers")
    .select("id, first_name, last_name, email, phone, whatsapp, accommodation, certification_level")
    .eq("dive_center_id", diveCenterId)
    .order("created_at", { ascending: false })
    .limit(20);

  return attachLatestArrival(diveCenterId, rows ?? []);
}

export async function searchDivers(diveCenterId: string, query: string): Promise<DiverListItem[]> {
  const supabase = await createClient();
  const q = `%${query.trim()}%`;

  const { data: rows } = await supabase
    .from("divers")
    .select("id, first_name, last_name, email, phone, whatsapp, accommodation, certification_level")
    .eq("dive_center_id", diveCenterId)
    .or(
      `first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},whatsapp.ilike.${q},phone.ilike.${q},accommodation.ilike.${q}`,
    )
    .limit(10);

  return attachLatestArrival(diveCenterId, rows ?? []);
}
