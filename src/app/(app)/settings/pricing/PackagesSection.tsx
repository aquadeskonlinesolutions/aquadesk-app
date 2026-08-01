"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { savePackage, deletePackage } from "./actions";
import type { Package } from "./data";

function peso(n: number) {
  return `₱${n.toLocaleString()}`;
}

export function PackagesSection({ packages }: { packages: Package[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [site, setSite] = useState("");
  const [price, setPrice] = useState("");
  const [equipIncluded, setEquipIncluded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setName("");
    setSite("");
    setPrice("");
    setEquipIncluded(false);
    setError(null);
  }
  function startEdit(p: Package) {
    setEditingId(p.id);
    setAdding(false);
    setName(p.package_name);
    setSite(p.dive_site ?? "");
    setPrice(String(p.price));
    setEquipIncluded(p.equipment_included);
    setError(null);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }
  function save() {
    startTransition(async () => {
      const res = await savePackage(
        editingId,
        name,
        site,
        parseFloat(price) || 0,
        equipIncluded,
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
      await deletePackage(id);
    });
  }

  return (
    <SettingsSection
      title="Packages"
      subtitle="Fixed price packages linked to dive sites"
      action={
        !adding && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Package
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {(adding || editingId) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Package Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Dive Site Combination
            </label>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
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
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-1.5">
            <input
              type="checkbox"
              checked={equipIncluded}
              onChange={(e) => setEquipIncluded(e.target.checked)}
            />
            Equipment included
          </label>
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

      {packages.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No packages yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {packages.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-4 py-3 border border-gray-200 rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium text-navy">{p.package_name}</div>
                <div className="text-xs text-gray-400">
                  {p.dive_site || "—"} · Equipment{" "}
                  {p.equipment_included ? "included" : "not included"}
                </div>
              </div>
              <div className="font-semibold text-navy">{peso(p.price)}</div>
              <button
                onClick={() => startEdit(p)}
                className="text-xs text-teal hover:text-navy"
              >
                Edit
              </button>
              <button
                onClick={() => remove(p.id)}
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
