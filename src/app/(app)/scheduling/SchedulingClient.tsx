"use client";

import { useState, useTransition } from "react";
import type { TripSummary, BoatOption, DiveSiteOption, StaffOption, DayAssignment } from "./data";
import { getTripsForDate, getDayAssignmentsForWarnings } from "./actions";
import { PhaseTabs, type Phase } from "./components/PhaseTabs";
import { PhaseOnePanel } from "./components/PhaseOnePanel";
import { PhaseTwoPanel } from "./components/PhaseTwoPanel";
import { PhaseThreePanel } from "./components/PhaseThreePanel";

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function SchedulingClient({
  boats,
  diveSites,
  staffOptions,
}: {
  boats: BoatOption[];
  diveSites: DiveSiteOption[];
  staffOptions: StaffOption[];
}) {
  const [date, setDate] = useState("");
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [dayContext, setDayContext] = useState<DayAssignment[]>([]);
  const [phase, setPhase] = useState<Phase>("phase1");
  const [pending, startTransition] = useTransition();

  const isPastDate = date !== "" && date < todayManila();

  function loadForDate(newDate: string) {
    startTransition(async () => {
      const [tripsRes, dayCtx] = await Promise.all([
        getTripsForDate(newDate),
        getDayAssignmentsForWarnings(newDate),
      ]);
      setTrips(tripsRes);
      setDayContext(dayCtx);
      const hasSavedTrips = tripsRes.some((t) => !t.cancelled);
      const past = newDate < todayManila();
      setPhase(past || hasSavedTrips ? "phase3" : "phase1");
    });
  }

  function changeDate(newDate: string) {
    setDate(newDate);
    if (newDate) loadForDate(newDate);
  }

  // Refreshes trips/context in place without resetting phase (e.g. after a
  // save within Phase 2 or a Boat Returned in Phase 3) — a lighter path
  // than loadForDate, which also re-decides the default phase.
  async function refreshInPlace() {
    if (!date) return;
    const [tripsRes, dayCtx] = await Promise.all([getTripsForDate(date), getDayAssignmentsForWarnings(date)]);
    setTrips(tripsRes);
    setDayContext(dayCtx);
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-navy mb-1">Scheduling</h1>
          <p className="text-gray-600 text-sm">Trip/schedule builder, boat and staff assignment.</p>
        </div>
        <div>
          <input
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {!date ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-400 text-sm">
          Select a schedule date to begin.
        </div>
      ) : pending && trips.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-8">Loading…</div>
      ) : (
        <>
          {isPastDate && (
            <div className="text-xs bg-teal/10 text-teal px-3 py-2 rounded-md">
              Past schedule — you can review this date. Only unclosed trips can still be marked Boat Returned.
            </div>
          )}

          <PhaseTabs phase={phase} onChange={setPhase} readOnly={isPastDate} />

          {phase === "phase1" && (
            <PhaseOnePanel
              key={date}
              scheduleDate={date}
              staffOptions={staffOptions}
              readOnly={isPastDate}
              onNext={() => setPhase("phase2")}
            />
          )}

          {phase === "phase2" && (
            <PhaseTwoPanel
              scheduleDate={date}
              trips={trips}
              boats={boats}
              diveSites={diveSites}
              staffOptions={staffOptions}
              dayContext={dayContext}
              readOnly={isPastDate}
              onChanged={refreshInPlace}
              onConfirm={() => {
                refreshInPlace();
                setPhase("phase3");
              }}
            />
          )}

          {phase === "phase3" && (
            <PhaseThreePanel
              trips={trips}
              boats={boats}
              staffOptions={staffOptions}
              readOnly={isPastDate}
              onChanged={refreshInPlace}
            />
          )}
        </>
      )}
    </div>
  );
}
