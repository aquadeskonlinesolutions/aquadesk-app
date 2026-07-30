"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  notes: string | null;
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
  tank_tally: { tank_12l: number; tank_15l: number; nitrox: number };
};

function fmtTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${ampm}`;
}

function groupByStaff(divers: CrewDiver[]): { staffLabel: string; divers: CrewDiver[] }[] {
  const groups = new Map<string, CrewDiver[]>();
  for (const d of divers) {
    const key = d.staff_name ? `${d.staff_name}${d.staff_position ? ` (${d.staff_position})` : ""}` : "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  return Array.from(groups.entries()).map(([staffLabel, divers]) => ({ staffLabel, divers }));
}

export function CrewScheduleClient() {
  const [tokenInput, setTokenInput] = useState("");
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
    setTrips((data?.trips as CrewTrip[]) ?? []);
  }

  if (trips === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-off-white px-4">
        <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h1 className="font-display text-2xl text-navy mb-1">Today&apos;s Schedule</h1>
          <p className="text-gray-600 text-sm mb-4">
            Enter the code your dive center gave you today.
          </p>
          {error && <div className="text-sm text-red mb-3">{error}</div>}
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={5}
            placeholder="e.g. A7K2M"
            className="w-full text-center text-2xl font-mono tracking-widest border-2 border-gray-200 rounded-lg px-4 py-3 outline-none focus:border-teal transition-colors mb-3"
          />
          <button
            onClick={submit}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
          >
            {loading ? "Checking…" : "View Schedule"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-off-white px-4 py-6">
      <div className="max-w-2xl mx-auto grid gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-navy">Today&apos;s Schedule</h1>
          <button
            onClick={() => {
              setTrips(null);
              setTokenInput("");
            }}
            className="text-sm text-gray-500 hover:underline"
          >
            Use a different code
          </button>
        </div>

        {trips.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
            No trips scheduled for today.
          </div>
        ) : (
          trips.map((trip) => (
            <div key={trip.schedule_id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                <div>
                  <div className="font-display text-lg text-navy">
                    {trip.boat?.name ?? "Boat TBD"} — {fmtTime(trip.departure_time)}
                  </div>
                  {trip.boat?.captain && (
                    <div className="text-xs text-gray-400">Captain: {trip.boat.captain}</div>
                  )}
                  {trip.crew.length > 0 && (
                    <div className="text-xs text-gray-400">Crew: {trip.crew.join(", ")}</div>
                  )}
                </div>
                <div className="text-sm text-gray-600 text-right">
                  {trip.dive_sites.length > 0 ? trip.dive_sites.join(", ") : "Site TBD"}
                </div>
              </div>

              {trip.is_joiner && (
                <div className="mb-3 text-xs font-medium text-amber-700 bg-amber-100 rounded-md px-2.5 py-1 inline-block">
                  We&apos;re joining {trip.joiner_boat_name || "another boat"} today
                </div>
              )}

              <div className="flex gap-4 text-xs text-gray-500 mb-3">
                <span>12L tanks: {trip.tank_tally.tank_12l}</span>
                <span>15L tanks: {trip.tank_tally.tank_15l}</span>
                <span>Nitrox: {trip.tank_tally.nitrox}</span>
              </div>

              <div className="grid gap-3">
                {groupByStaff(trip.divers).map((g) => (
                  <div key={g.staffLabel} className="border border-gray-200 rounded-lg p-3">
                    <div className="text-sm font-semibold text-navy mb-2">{g.staffLabel}</div>
                    <div className="grid gap-1.5">
                      {g.divers.map((d, i) => (
                        <div key={i} className="text-sm text-gray-700 flex flex-wrap items-center gap-2">
                          <span className="font-medium">{d.diver_name}</span>
                          <span className="text-gray-400 text-xs">
                            {[d.nationality, d.certification_level, d.age ? `${d.age}y` : null, d.group_name]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {d.nitrox_requested && (
                            <span className="text-xs bg-teal/10 text-teal px-1.5 py-0.5 rounded">Nitrox</span>
                          )}
                          {d.is_15l && (
                            <span className="text-xs bg-navy/10 text-navy px-1.5 py-0.5 rounded">15L</span>
                          )}
                          {d.experience_type && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {d.experience_type}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {trip.notes && (
                <div className="mt-3 text-xs text-gray-500 border-t border-gray-200 pt-3">{trip.notes}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
