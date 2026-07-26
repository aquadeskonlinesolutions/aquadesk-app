"use client";

import { useState, useTransition } from "react";
import type { TripSummary, BoatOption, DiveSiteOption, StaffOption, CourseRateOption } from "./data";
import { getTripsForDate } from "./actions";
import { DaySelector } from "./components/DaySelector";
import { TripListPanel } from "./components/TripListPanel";
import { TripBuilderPanel } from "./components/TripBuilderPanel";
import { DiverAssignmentPanel } from "./components/DiverAssignmentPanel";
import { ConfirmPanel } from "./components/ConfirmPanel";

export function SchedulingClient({
  diveCenterId,
  initialDate,
  initialTrips,
  boats,
  diveSites,
  staffOptions,
  courseRates,
}: {
  diveCenterId: string;
  initialDate: string;
  initialTrips: TripSummary[];
  boats: BoatOption[];
  diveSites: DiveSiteOption[];
  staffOptions: StaffOption[];
  courseRates: CourseRateOption[];
}) {
  const [date, setDate] = useState(initialDate);
  const [trips, setTrips] = useState(initialTrips);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [diverSaveVersion, setDiverSaveVersion] = useState(0);
  const [pending, startTransition] = useTransition();

  function changeDate(newDate: string) {
    setDate(newDate);
    setSelected(null);
    startTransition(async () => {
      setTrips(await getTripsForDate(newDate));
    });
  }

  function refreshTrips() {
    startTransition(async () => {
      setTrips(await getTripsForDate(date));
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-navy mb-1">Scheduling</h1>
          <p className="text-gray-600 text-sm">
            Trip/schedule builder, boat and staff assignment.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelected("new")}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors"
          >
            + Add Trip
          </button>
        </div>
      </div>

      <DaySelector date={date} onChange={changeDate} />

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5 items-start">
        <TripListPanel
          trips={trips}
          pending={pending}
          selectedId={selected}
          onSelect={setSelected}
        />

        {selected && (
          <div className="grid gap-5">
            <TripBuilderPanel
              key={selected}
              diveCenterId={diveCenterId}
              scheduleId={selected === "new" ? null : selected}
              scheduleDate={date}
              boats={boats}
              diveSites={diveSites}
              onSaved={(savedId) => {
                setSelected(savedId);
                refreshTrips();
              }}
              onDeletedOrCancelled={() => {
                setSelected(null);
                refreshTrips();
              }}
            />
            {selected !== "new" && (
              <>
                <DiverAssignmentPanel
                  key={`divers-${selected}`}
                  scheduleId={selected}
                  scheduleDate={date}
                  staffOptions={staffOptions}
                  courseRates={courseRates}
                  boats={boats}
                  onSaved={() => {
                    refreshTrips();
                    setDiverSaveVersion((v) => v + 1);
                  }}
                />
                <ConfirmPanel
                  key={`confirm-${selected}`}
                  scheduleId={selected}
                  staffOptions={staffOptions}
                  refreshKey={diverSaveVersion}
                  onReturned={() => {
                    refreshTrips();
                    setDiverSaveVersion((v) => v + 1);
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
