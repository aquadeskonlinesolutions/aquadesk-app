"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveTanks, type TankRowInput } from "./actions";
import type { Tank } from "./data";
import { TANK_TYPES } from "./constants";

export function TanksSection({ tanks }: { tanks: Tank[] }) {
  const [rows, setRows] = useState<TankRowInput[]>(() =>
    tanks.map((t) => ({
      id: t.id,
      type: t.type,
      totalCount: t.total_count,
      availableCount: t.available_count,
      inUseCount: t.in_use_count,
      lowAlertThreshold: t.low_alert_threshold,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(type: string, field: keyof TankRowInput, value: number) {
    setRows(rows.map((r) => (r.type === type ? { ...r, [field]: value } : r)));
  }

  function save() {
    startTransition(async () => {
      const res = await saveTanks(rows);
      if (res.error) setError(res.error);
      else setError(null);
    });
  }

  return (
    <SettingsSection
      title="Tanks"
      subtitle="Dashboard alerts fire when available count drops to or below the threshold"
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase">
            <th className="pb-2">Tank Type</th>
            <th className="pb-2">Total Count</th>
            <th className="pb-2">Available</th>
            <th className="pb-2">In Use</th>
            <th className="pb-2">Low Alert Threshold</th>
          </tr>
        </thead>
        <tbody>
          {TANK_TYPES.map((t) => {
            const row = rows.find((r) => r.type === t.value)!;
            return (
              <tr key={t.value} className="border-t border-gray-100">
                <td className="py-2 pr-2 font-medium text-navy">{t.label}</td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={row.totalCount}
                    onChange={(e) => update(t.value, "totalCount", parseInt(e.target.value) || 0)}
                    className="w-20 border border-gray-300 rounded-md px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={row.availableCount}
                    onChange={(e) =>
                      update(t.value, "availableCount", parseInt(e.target.value) || 0)
                    }
                    className="w-20 border border-gray-300 rounded-md px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={row.inUseCount}
                    onChange={(e) => update(t.value, "inUseCount", parseInt(e.target.value) || 0)}
                    className="w-20 border border-gray-300 rounded-md px-2 py-1"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    min={0}
                    value={row.lowAlertThreshold}
                    onChange={(e) =>
                      update(t.value, "lowAlertThreshold", parseInt(e.target.value) || 0)
                    }
                    className="w-20 border border-gray-300 rounded-md px-2 py-1"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        onClick={save}
        disabled={pending}
        className="px-3 py-1.5 text-sm font-medium text-teal border border-teal rounded-md hover:bg-teal-light disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Tanks"}
      </button>
    </SettingsSection>
  );
}
