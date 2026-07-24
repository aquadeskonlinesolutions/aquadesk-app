"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveDiveSite, deleteDiveSite } from "./actions";
import type { DiveSite, PackageOption } from "./data";

export function DiveSitesSection({
  sites,
  packages,
  pricingMode,
}: {
  sites: DiveSite[];
  packages: PackageOption[];
  pricingMode: string | null;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [distance, setDistance] = useState("");
  const [fuelEstimate, setFuelEstimate] = useState<"Low" | "Medium" | "High">("High");
  const [sharkFee, setSharkFee] = useState(false);
  const [linkedPackageId, setLinkedPackageId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setName("");
    setDistance("");
    setFuelEstimate("High");
    setSharkFee(false);
    setLinkedPackageId("");
    setError(null);
  }
  function startEdit(s: DiveSite) {
    setEditingId(s.id);
    setAdding(false);
    setName(s.site_name);
    setDistance(s.distance ?? "");
    setFuelEstimate((s.fuel_estimate as "Low" | "Medium" | "High") ?? "High");
    setSharkFee(s.shark_fee);
    setLinkedPackageId(s.linked_package_id ?? "");
    setError(null);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }
  function save() {
    startTransition(async () => {
      const res = await saveDiveSite(
        editingId,
        name,
        distance,
        fuelEstimate,
        sharkFee,
        linkedPackageId || null,
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
      await deleteDiveSite(id);
    });
  }

  function packageName(id: string | null) {
    if (!id) return "—";
    return packages.find((p) => p.id === id)?.package_name ?? "—";
  }

  return (
    <SettingsSection
      title="Dive Sites"
      subtitle="Active sites appear as dropdown in Scheduling"
      action={
        !adding && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Site
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {(adding || editingId) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Site Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Distance</label>
            <input
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="30 mins"
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-28"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fuel Estimate
            </label>
            <select
              value={fuelEstimate}
              onChange={(e) => setFuelEstimate(e.target.value as "Low" | "Medium" | "High")}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-1.5">
            <input
              type="checkbox"
              checked={sharkFee}
              onChange={(e) => setSharkFee(e.target.checked)}
            />
            Shark fee applies
          </label>
          {pricingMode === "package" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Linked Package
              </label>
              <select
                value={linkedPackageId}
                onChange={(e) => setLinkedPackageId(e.target.value)}
                className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              >
                <option value="">None</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.package_name}
                  </option>
                ))}
              </select>
            </div>
          )}
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

      {sites.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No dive sites yet. Add your local sites.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sites.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 px-4 py-3 border border-gray-200 rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium text-navy">{s.site_name}</div>
                <div className="text-xs text-gray-400">
                  Distance: {s.distance || "—"} · Fuel: {s.fuel_estimate} · Shark Fee:{" "}
                  {s.shark_fee ? "Yes" : "No"}
                  {pricingMode === "package" && (
                    <> · Linked Package: {packageName(s.linked_package_id)}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => startEdit(s)}
                className="text-xs text-teal hover:text-navy"
              >
                Edit
              </button>
              <button
                onClick={() => remove(s.id)}
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
