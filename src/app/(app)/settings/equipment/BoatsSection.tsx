"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveBoat, deleteBoat } from "./actions";
import type { Boat } from "./data";

const BOAT_TYPES = [
  { label: "Outrigger", value: "outrigger" },
  { label: "Flat Boat", value: "flat_boat" },
  { label: "Chase Boat", value: "chase_boat" },
  { label: "Speed Boat", value: "speed_boat" },
];
const FUEL_TYPES = [
  { label: "Gasoline", value: "gasoline" },
  { label: "Diesel", value: "diesel" },
];

function label(list: { label: string; value: string }[], value: string | null) {
  return list.find((x) => x.value === value)?.label ?? list[0].label;
}

export function BoatsSection({ boats }: { boats: Boat[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [boatType, setBoatType] = useState(BOAT_TYPES[0].value);
  const [fuelType, setFuelType] = useState(FUEL_TYPES[0].value);
  const [capacity, setCapacity] = useState("");
  const [captain, setCaptain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setName("");
    setBoatType(BOAT_TYPES[0].value);
    setFuelType(FUEL_TYPES[0].value);
    setCapacity("");
    setCaptain("");
    setError(null);
  }
  function startEdit(b: Boat) {
    setEditingId(b.id);
    setAdding(false);
    setName(b.name);
    setBoatType(b.boat_type ?? BOAT_TYPES[0].value);
    setFuelType(b.fuel_type ?? FUEL_TYPES[0].value);
    setCapacity(b.capacity != null ? String(b.capacity) : "");
    setCaptain(b.captain ?? "");
    setError(null);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }
  function save() {
    startTransition(async () => {
      const res = await saveBoat(
        editingId,
        name,
        boatType,
        fuelType,
        capacity === "" ? null : parseInt(capacity) || 0,
        captain,
      );
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
      await deleteBoat(id);
    });
  }

  return (
    <SettingsSection
      title="Fleet"
      subtitle="Boats appear as dropdown options in Scheduling"
      action={
        !adding && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Boat
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {(adding || editingId) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Boat Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Boat Type</label>
            <select
              value={boatType}
              onChange={(e) => setBoatType(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            >
              {BOAT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Type</label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            >
              {FUEL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Diver Capacity
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-24"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Captain (optional)
            </label>
            <input
              value={captain}
              onChange={(e) => setCaptain(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
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

      {boats.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No boats yet. Add your first boat.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {boats.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-4 px-4 py-3 border border-gray-200 rounded-lg"
            >
              <div className="text-xl shrink-0">🚤</div>
              <div className="flex-1">
                <div className="font-semibold text-navy">{b.name}</div>
                <div className="text-xs text-gray-400">
                  {label(BOAT_TYPES, b.boat_type)} · {label(FUEL_TYPES, b.fuel_type)} ·{" "}
                  {b.capacity ?? 0} divers · Captain: {b.captain || "—"}
                </div>
              </div>
              <button
                onClick={() => startEdit(b)}
                className="text-xs text-teal hover:text-navy"
              >
                Edit
              </button>
              <button
                onClick={() => remove(b.id)}
                className="text-xs text-red hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
