"use client";

import { useState } from "react";
import type { TripSummary, BoatOption, DiveSiteOption, StaffOption, DayAssignment, TripTypeOption } from "../data";
import { TripCard } from "./TripCard";
import { Button } from "@/components/ui/Button";

export function PhaseTwoPanel({
  scheduleDate,
  trips,
  boats,
  diveSites,
  staffOptions,
  tripTypeOptions,
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
  tripTypeOptions: TripTypeOption[];
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
          <Button variant="primary" size="md" onClick={() => setNewTripKeys((k) => [...k, Date.now()])}>
            + New Trip
          </Button>
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
          tripTypeOptions={tripTypeOptions}
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
          tripTypeOptions={tripTypeOptions}
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
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
          No trips yet — click &ldquo;+ New Trip&rdquo; to build one.
        </div>
      )}

      {!readOnly && (activeTrips.length > 0 || newTripKeys.length > 0) && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shadow-lg z-10">
          <div className="text-sm text-gray-600">
            {activeTrips.length} trip{activeTrips.length === 1 ? "" : "s"} built · {totalDivers} placed diver
            {totalDivers === 1 ? "" : "s"}
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={onConfirm}
            disabled={newTripKeys.length > 0}
            title={newTripKeys.length > 0 ? "Save or remove unsaved trips first" : undefined}
          >
            Confirm Schedule →
          </Button>
        </div>
      )}
    </div>
  );
}
