"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveGear, type GearRowInput } from "./actions";
import type { GearItem } from "./data";

export function GearSection({ gear }: { gear: GearItem[] }) {
  const [rows, setRows] = useState<GearRowInput[]>(() =>
    gear.map((g) => ({
      id: g.id,
      name: g.name,
      totalCount: g.totalCount,
      lowAlertThreshold: g.lowAlertThreshold,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(name: string, field: "totalCount" | "lowAlertThreshold", value: number) {
    setRows(rows.map((r) => (r.name === name ? { ...r, [field]: value } : r)));
  }

  function save() {
    startTransition(async () => {
      const res = await saveGear(rows);
      if (res.error) setError(res.error);
      else setError(null);
    });
  }

  return (
    <SettingsSection
      title="Rental Gear"
      subtitle="Track counts for each gear item — alerts fire when count drops to or below threshold"
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase">
            <th className="pb-2">Gear Item</th>
            <th className="pb-2">Total Count</th>
            <th className="pb-2">Low Alert Threshold</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-gray-100">
              <td className="py-2 pr-2 font-medium text-navy">{row.name}</td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  min={0}
                  value={row.totalCount}
                  onChange={(e) => update(row.name, "totalCount", parseInt(e.target.value) || 0)}
                  className="w-20 border border-gray-300 rounded-md px-2 py-1"
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  value={row.lowAlertThreshold}
                  onChange={(e) =>
                    update(row.name, "lowAlertThreshold", parseInt(e.target.value) || 0)
                  }
                  className="w-20 border border-gray-300 rounded-md px-2 py-1"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={save}
        disabled={pending}
        className="px-3 py-1.5 text-sm font-medium text-teal border border-teal rounded-md hover:bg-teal-light disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Gear Counts"}
      </button>
    </SettingsSection>
  );
}
