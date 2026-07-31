"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveTripType, deleteTripType } from "./actions";
import type { TripType } from "./data";

export function TripTypesSection({ tripTypes }: { tripTypes: TripType[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [travelOut, setTravelOut] = useState(0);
  const [travelBack, setTravelBack] = useState(0);
  const [diveMinutes, setDiveMinutes] = useState(60);
  const [surfaceInterval, setSurfaceInterval] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setName("");
    setTravelOut(0);
    setTravelBack(0);
    setDiveMinutes(60);
    setSurfaceInterval(60);
    setError(null);
  }
  function startEdit(t: TripType) {
    setEditingId(t.id);
    setAdding(false);
    setName(t.name);
    setTravelOut(t.travel_out_minutes);
    setTravelBack(t.travel_back_minutes);
    setDiveMinutes(t.dive_minutes);
    setSurfaceInterval(t.surface_interval_minutes);
    setError(null);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }
  function save() {
    startTransition(async () => {
      const res = await saveTripType(editingId, name, travelOut, travelBack, diveMinutes, surfaceInterval);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setAdding(false);
        setEditingId(null);
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      await deleteTripType(id);
    });
  }

  return (
    <SettingsSection
      title="Trip Types"
      subtitle="Travel/dive/surface-interval minutes per trip type — used in Scheduling to flag genuinely overlapping trips, not just same-day ones"
      action={
        !adding && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Trip Type
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {(adding || editingId) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Local Dive"
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Travel Out (min)</label>
            <input
              type="number"
              min={0}
              value={travelOut}
              onChange={(e) => setTravelOut(parseInt(e.target.value) || 0)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-24"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Travel Back (min)</label>
            <input
              type="number"
              min={0}
              value={travelBack}
              onChange={(e) => setTravelBack(parseInt(e.target.value) || 0)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-24"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Per Dive (min)</label>
            <input
              type="number"
              min={0}
              value={diveMinutes}
              onChange={(e) => setDiveMinutes(parseInt(e.target.value) || 0)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-24"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Surface Interval (min)</label>
            <input
              type="number"
              min={0}
              value={surfaceInterval}
              onChange={(e) => setSurfaceInterval(parseInt(e.target.value) || 0)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-24"
            />
          </div>
          <button
            onClick={save}
            disabled={pending}
            className="px-3 py-1.5 text-sm font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
          >
            Save
          </button>
          <button onClick={cancel} className="px-3 py-1.5 text-sm text-gray-600">
            Cancel
          </button>
        </div>
      )}

      {tripTypes.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No trip types yet. Add one to enable real turnaround-time conflict detection in Scheduling.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tripTypes.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-4 px-4 py-3 border border-gray-200 rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium text-navy">{t.name}</div>
                <div className="text-xs text-gray-400">
                  Travel: {t.travel_out_minutes}min out / {t.travel_back_minutes}min back · Dive:{" "}
                  {t.dive_minutes}min · Surface Interval: {t.surface_interval_minutes}min
                </div>
              </div>
              <button onClick={() => startEdit(t)} className="text-xs text-teal hover:text-navy">
                Edit
              </button>
              <button onClick={() => remove(t.id)} className="text-xs text-red hover:underline">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
