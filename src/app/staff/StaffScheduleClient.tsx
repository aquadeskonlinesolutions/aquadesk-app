"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeTankTally, formatTankLine } from "../(app)/scheduling/tanks";
import { CERT_LEVEL_LABELS, EXPERIENCE_TYPE_LABELS } from "./constants";

// Mirrors staff.html's own ISO_MAP — a small subset of nationality names
// mapped to a 3-letter badge, falling back to a truncated raw string for
// anything unmapped (matching the old app's own fallback exactly).
const ISO_MAP: Record<string, string> = {
  philippines: "PHL",
  filipino: "PHL",
  "united kingdom": "GBR",
  british: "GBR",
  uk: "GBR",
  "united states": "USA",
  american: "USA",
  usa: "USA",
  us: "USA",
  germany: "DEU",
  german: "DEU",
  france: "FRA",
  french: "FRA",
  australia: "AUS",
  australian: "AUS",
  "south korea": "KOR",
  korean: "KOR",
  japan: "JPN",
  japanese: "JPN",
  china: "CHN",
  chinese: "CHN",
  israel: "ISR",
  israeli: "ISR",
  sweden: "SWE",
  swedish: "SWE",
  norway: "NOR",
  norwegian: "NOR",
  denmark: "DNK",
  danish: "DNK",
  finland: "FIN",
  finnish: "FIN",
  netherlands: "NLD",
  dutch: "NLD",
  switzerland: "CHE",
  swiss: "CHE",
  italy: "ITA",
  italian: "ITA",
  spain: "ESP",
  spanish: "ESP",
  canada: "CAN",
  canadian: "CAN",
  "new zealand": "NZL",
  singapore: "SGP",
  "hong kong": "HKG",
  taiwan: "TWN",
  taiwanese: "TWN",
  thailand: "THA",
  thai: "THA",
};

function getIso(nationality: string | null): string | null {
  if (!nationality) return null;
  const key = nationality.toLowerCase().trim();
  return ISO_MAP[key] ?? nationality.trim().slice(0, 10) ?? null;
}

type DiveTank = { site_index: number; tank_type: "nitrox" | "air_15l" };
type StaffDiveTank = { staff_name: string; site_index: number };
type SpareTank = { tank_type: "air_12l" | "air_15l" | "nitrox"; quantity: number };

type CrewDiver = {
  diver_name: string;
  nationality: string | null;
  certification_level: string | null;
  logged_dives: number | null;
  age: number | null;
  group_name: string | null;
  staff_name: string | null;
  staff_position: string | null;
  is_15l: boolean;
  nitrox_requested: boolean;
  experience_type: string | null;
  course_name: string | null;
  notes: string | null;
  dive_tanks: DiveTank[];
};

type CrewTrip = {
  schedule_id: string;
  departure_time: string | null;
  notes: string | null;
  is_joiner: boolean;
  joiner_boat_name: string | null;
  boat: { name: string | null; captain: string | null } | null;
  crew: string[];
  dive_sites: string[];
  divers: CrewDiver[];
  staff_dive_tanks: StaffDiveTank[];
  spare_tanks: SpareTank[];
};

function fmtTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${ampm}`;
}

function fmtHeaderDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function groupByStaff(divers: CrewDiver[]): { staffLabel: string; staffName: string | null; divers: CrewDiver[] }[] {
  const groups = new Map<string, CrewDiver[]>();
  for (const d of divers) {
    const key = d.staff_name ? `${d.staff_name}${d.staff_position ? ` (${d.staff_position})` : ""}` : "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  return Array.from(groups.entries()).map(([staffLabel, divers]) => ({
    staffLabel,
    staffName: divers[0]?.staff_name ?? null,
    divers,
  }));
}

function tripTankTally(trip: CrewTrip) {
  const siteCount = trip.dive_sites.length || 1;
  const staffNames = Array.from(new Set(trip.divers.map((d) => d.staff_name).filter((n): n is string => !!n)));
  const staffTanksByName = new Map<string, number[]>();
  trip.staff_dive_tanks.forEach((t) => {
    const list = staffTanksByName.get(t.staff_name) ?? [];
    list.push(t.site_index);
    staffTanksByName.set(t.staff_name, list);
  });
  return computeTankTally({
    siteCount,
    diverTanks: trip.divers.map((d) => d.dive_tanks.map((t) => ({ siteIndex: t.site_index, tankType: t.tank_type }))),
    staffNitroxSiteIndexesByTeam: staffNames.map((name) => staffTanksByName.get(name) ?? []),
    spareTanks: trip.spare_tanks.map((t) => ({ type: t.tank_type, quantity: t.quantity })),
  });
}

function diverMetaLine(d: CrewDiver): string {
  const parts = [
    d.certification_level ? (CERT_LEVEL_LABELS[d.certification_level] ?? d.certification_level) : null,
    d.logged_dives != null && d.logged_dives > 0 ? `${d.logged_dives} dives` : null,
    d.age != null && d.age > 0 ? `Age ${d.age}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function diverExpLine(d: CrewDiver): string | null {
  if (d.experience_type === "dive_course") {
    return d.course_name ? `📚 ${d.course_name}` : "📚 Dive Course";
  }
  if (d.experience_type) {
    return EXPERIENCE_TYPE_LABELS[d.experience_type] ?? d.experience_type;
  }
  return null;
}

export function StaffScheduleClient() {
  const [tokenInput, setTokenInput] = useState("");
  const [dcName, setDcName] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [trips, setTrips] = useState<CrewTrip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const token = tokenInput.trim().toUpperCase();
    if (token.length !== 5) {
      setError("Enter the 5-character code your dive center gave you.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("get_crew_schedule", { p_token: token });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (data?.error) {
      setError(data.error);
      setTrips(null);
      return;
    }
    setDcName(data?.dive_center_name ?? null);
    setScheduleDate(data?.schedule_date ?? null);
    setTrips((data?.trips as CrewTrip[]) ?? []);
  }

  if (trips === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-off-white px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-md p-6 text-center">
          <div className="font-display text-2xl text-navy mb-1">Today&apos;s Schedule</div>
          <p className="text-gray-400 text-sm mb-5">Enter today&apos;s token to view the schedule</p>
          {error && (
            <div className="text-sm text-red bg-red-light border border-red rounded-lg px-3 py-2 mb-3 text-left">
              {error}
            </div>
          )}
          <div className="text-left mb-3">
            <label className="block text-xs font-bold text-navy mb-1.5">Today&apos;s Token</label>
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={5}
              placeholder="A3F9B"
              className="w-full text-center text-2xl font-bold tracking-widest border-2 border-gray-200 rounded-lg px-4 py-3 outline-none focus:border-teal transition-colors"
            />
          </div>
          <button
            onClick={submit}
            disabled={loading}
            className="w-full px-4 py-3 bg-teal text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? "Checking…" : "View Schedule"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-off-white">
      <div className="sticky top-0 z-50 bg-navy px-5 py-3.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white font-bold text-sm">AquaDesk</span>
        </div>
        {dcName && <div className="text-teal font-semibold text-sm mb-0.5">{dcName}</div>}
        <div className="text-white/75 text-xs">📅 {fmtHeaderDate(scheduleDate)}</div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-12 grid gap-4">
        {trips.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">
            🌊 No trips scheduled for today.
          </div>
        ) : (
          trips.map((trip) => {
            const tally = tripTankTally(trip);
            const boatIcon = trip.is_joiner ? "🔗" : "🚤";
            return (
              <div key={trip.schedule_id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="bg-gray-100 px-5 py-4 border-b border-gray-200">
                  <div className="font-display text-navy text-lg mb-1 flex items-center gap-2 flex-wrap">
                    <span>
                      {boatIcon} {trip.boat?.name ?? "Boat TBD"}
                    </span>
                    {trip.is_joiner && (
                      <span className="text-xs font-bold bg-orange-light text-orange rounded-full px-2.5 py-0.5">
                        Join Ride
                      </span>
                    )}
                  </div>
                  {trip.is_joiner && trip.joiner_boat_name ? (
                    <div className="text-xs text-gray-600">🏪 Joining: {trip.joiner_boat_name}</div>
                  ) : (
                    <>
                      {trip.boat?.captain && (
                        <div className="text-xs text-gray-600">👨‍✈️ Captain: {trip.boat.captain}</div>
                      )}
                      {trip.crew.length > 0 && (
                        <div className="text-xs text-gray-600">🧑‍🤝‍🧑 Crew: {trip.crew.join(", ")}</div>
                      )}
                    </>
                  )}
                </div>

                {/* Dive Info */}
                <div className="px-5 py-3.5 border-b border-gray-200">
                  <div className="text-[0.7rem] font-extrabold text-gray-400 uppercase tracking-wide mb-1.5">
                    Dive Info
                  </div>
                  <div className="text-sm text-navy">📍 {trip.dive_sites.length ? trip.dive_sites.join(" · ") : "Site TBD"}</div>
                  {trip.dive_sites.length > 0 && (
                    <div className="text-xs text-gray-600 mt-1">
                      🤿 {trip.dive_sites.length} dive{trip.dive_sites.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 mt-1">🕗 Departure: {fmtTime(trip.departure_time)}</div>
                </div>

                {/* Staff & Divers */}
                <div className="px-5 py-3.5 border-b border-gray-200">
                  <div className="text-[0.7rem] font-extrabold text-gray-400 uppercase tracking-wide mb-2">
                    Staff & Divers
                  </div>
                  {trip.divers.length === 0 ? (
                    <div className="text-sm text-gray-400">No divers assigned</div>
                  ) : (
                    <div className="grid gap-2.5">
                      {groupByStaff(trip.divers).map((g) => {
                        const isInstructor = g.divers.some((d) => d.staff_position === "instructor");
                        return (
                          <div key={g.staffLabel} className="border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
                            <div
                              className={`text-white text-sm font-extrabold px-3.5 py-2 bg-navy border-l-4 ${
                                isInstructor ? "border-l-orange" : "border-l-teal"
                              } flex items-center gap-1.5`}
                            >
                              {isInstructor ? "🎓" : "🤿"} {g.staffLabel}
                            </div>
                            <div className="p-2.5 grid gap-1.5">
                              {g.divers.map((d, i) => {
                                const iso = getIso(d.nationality);
                                const expLine = diverExpLine(d);
                                return (
                                  <div key={i} className="bg-gray-100 rounded-lg px-2.5 py-2">
                                    {d.group_name && (
                                      <span className="inline-block text-xs font-bold text-teal bg-teal-light rounded-full px-2 py-0.5 mb-1">
                                        👥 {d.group_name}
                                      </span>
                                    )}
                                    <div className="font-bold text-navy text-sm flex items-center gap-1.5 flex-wrap">
                                      {d.diver_name}
                                      {iso && (
                                        <span className="text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                                          {iso}
                                        </span>
                                      )}
                                    </div>
                                    {diverMetaLine(d) && (
                                      <div className="text-xs text-gray-600 mt-0.5">{diverMetaLine(d)}</div>
                                    )}
                                    {expLine && (
                                      <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <span>{expLine}</span>
                                        {(d.nitrox_requested || d.dive_tanks.some((t) => t.tank_type === "nitrox")) && (
                                          <span className="text-[0.72rem] font-bold text-teal bg-teal-light rounded-full px-2 py-0.5">
                                            🟢 Nitrox
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {!expLine && (d.nitrox_requested || d.dive_tanks.some((t) => t.tank_type === "nitrox")) && (
                                      <div className="text-xs mt-0.5">
                                        <span className="text-[0.72rem] font-bold text-teal bg-teal-light rounded-full px-2 py-0.5">
                                          🟢 Nitrox
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Tank Tally */}
                <div className="px-5 py-3.5 border-b border-gray-200">
                  <div className="text-[0.7rem] font-extrabold text-gray-400 uppercase tracking-wide mb-1.5">
                    Tank Tally
                  </div>
                  <div className="text-sm font-semibold text-navy">
                    🪣 12L: {tally.air12l} &nbsp;·&nbsp; 📦 15L: {tally.air15l} &nbsp;·&nbsp; 🟢 Nitrox: {tally.nitrox}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatTankLine(tally)}</div>
                </div>

                {trip.notes && (
                  <div className="px-5 py-3.5">
                    <div className="text-[0.7rem] font-extrabold text-gray-400 uppercase tracking-wide mb-1.5">
                      Notes
                    </div>
                    <div className="text-sm text-gray-600">📝 {trip.notes}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
