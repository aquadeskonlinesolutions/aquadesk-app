"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveBundle, deleteBundle } from "./actions";
import type { Bundle } from "./data";

const DIVE_COUNT_OPTIONS = Array.from({ length: 100 }, (_, i) => i + 1);

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH")}`;
}

export function BundlesSection({ bundles }: { bundles: Bundle[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [diveCount, setDiveCount] = useState("3");
  const [price, setPrice] = useState("");
  const [equipmentIncluded, setEquipmentIncluded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setName("");
    setDiveCount("3");
    setPrice("");
    setEquipmentIncluded(true);
    setError(null);
  }
  function startEdit(b: Bundle) {
    setEditingId(b.id);
    setAdding(false);
    setName(b.name);
    setDiveCount(String(b.dive_count));
    setPrice(String(b.price));
    setEquipmentIncluded(b.equipment_included);
    setError(null);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }
  function save() {
    startTransition(async () => {
      const res = await saveBundle(
        editingId,
        name,
        parseInt(diveCount, 10) || 0,
        parseFloat(price) || 0,
        equipmentIncluded,
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
      await deleteBundle(id);
    });
  }

  return (
    <SettingsSection
      title="Bundles"
      subtitle="Multi-dive packages (e.g. 3, 6, 9, or 10-dive packages) at a flat price — applied per visit from Diver Form"
      action={
        !adding && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Bundle
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {(adding || editingId) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Bundle Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 6-Dive Package"
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Number of Dives
            </label>
            <select
              value={diveCount}
              onChange={(e) => setDiveCount(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            >
              {DIVE_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Price (PHP)
            </label>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-32"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={equipmentIncluded}
                onChange={(e) => setEquipmentIncluded(e.target.checked)}
              />
              Equipment included
            </label>
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

      {bundles.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No bundles yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bundles.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-4 px-4 py-3 border border-gray-200 rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium text-navy">{b.name}</div>
                <div className="text-xs text-gray-500">
                  {b.dive_count} dive{b.dive_count === 1 ? "" : "s"}
                  {!b.equipment_included && " · Equipment charged separately"}
                </div>
              </div>
              <div className="font-semibold text-navy">{peso(b.price)}</div>
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
