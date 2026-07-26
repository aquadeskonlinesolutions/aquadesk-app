"use client";

import { useState } from "react";
import type { TripSummary, BoatOption, DiveSiteOption, StaffOption, DayAssignment } from "../data";
import { TripCard } from "./TripCard";

export function PhaseTwoPanel({
  scheduleDate,
  trips,
  boats,
  diveSites,
  staffOptions,
  dayContext,
  readOnly,
  onChanged,
  onConfirm,
}: {
  scheduleDate: string;
  trips: TripSummary[];
  boats: BoatOption[];
  diveSites: DiveSiteOption[];
  staffOptions: StaffOption[];
  dayContext: DayAssignment[];
  readOnly: boolean;
  onChanged: () => void;
  onConfirm: () => void;
}) {
  const [newTripKeys, setNewTripKeys] = useState<number[]>([]);

  const totalDivers = trips.reduce((s, t) => s + t.diverCount, 0);
  const activeTrips = trips.filter((t) => !t.cancelled);

  return (
    <div className="grid gap-4 pb-20">
      {!readOnly && (
        <div className="flex justify-end">
          <button
            onClick={() => setNewTripKeys((k) => [...k, Date.now()])}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors"
          >
            + New Trip
          </button>
        </div>
      )}

      {activeTrips.map((t) => (
        <TripCard
          key={t.scheduleId}
          scheduleId={t.scheduleId}
          scheduleDate={scheduleDate}
          boats={boats}
          diveSites={diveSites}
          staffOptions={staffOptions}
          dayContext={dayContext}
          readOnly={readOnly}
          onSaved={onChanged}
          onDeletedOrCancelled={onChanged}
          onTeamsChanged={onChanged}
        />
      ))}

      {newTripKeys.map((key) => (
        <TripCard
          key={key}
          scheduleId={null}
          scheduleDate={scheduleDate}
          boats={boats}
          diveSites={diveSites}
          staffOptions={staffOptions}
          dayContext={dayContext}
          readOnly={readOnly}
          onSaved={() => {
            setNewTripKeys((k) => k.filter((x) => x !== key));
            onChanged();
          }}
          onDeletedOrCancelled={() => setNewTripKeys((k) => k.filter((x) => x !== key))}
          onTeamsChanged={onChanged}
        />
      ))}

      {activeTrips.length === 0 && newTripKeys.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
          No trips yet — click &ldquo;+ New Trip&rdquo; to build one.
        </div>
      )}

      {!readOnly && (activeTrips.length > 0 || newTripKeys.length > 0) && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shadow-lg z-10">
          <div className="text-sm text-gray-600">
            {activeTrips.length} trip{activeTrips.length === 1 ? "" : "s"} built · {totalDivers} placed diver
            {totalDivers === 1 ? "" : "s"}
          </div>
          <button
            onClick={onConfirm}
            disabled={newTripKeys.length > 0}
            title={newTripKeys.length > 0 ? "Save or remove unsaved trips first" : undefined}
            className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
          >
            Confirm Schedule →
          </button>
        </div>
      )}
    </div>
  );
}
