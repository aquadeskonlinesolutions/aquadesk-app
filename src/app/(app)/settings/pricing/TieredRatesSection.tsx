"use client";

import { useState, useTransition } from "react";
import { SettingsSection, InfoBox } from "@/components/settings/SettingsSection";
import { saveRateTiers, deleteRateTier, type TierRowInput } from "./actions";
import type { RateTier } from "./data";

type LocalRow = TierRowInput & { key: string };

function toLocalRows(tiers: RateTier[], rateType: RateTier["rate_type"]): LocalRow[] {
  return tiers
    .filter((t) => t.rate_type === rateType)
    .sort((a, b) => a.tier_from - b.tier_from)
    .map((t) => ({
      key: t.id,
      id: t.id,
      tierFrom: t.tier_from,
      tierTo: t.tier_to,
      baseRate: t.base_rate,
    }));
}

function TierTable({
  rateType,
  title,
  subtitle,
  rateColumnLabel,
  allTiers,
}: {
  rateType: RateTier["rate_type"];
  title: string;
  subtitle: string;
  rateColumnLabel: string;
  allTiers: RateTier[];
}) {
  const [rows, setRows] = useState<LocalRow[]>(() => toLocalRows(allTiers, rateType));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addRow() {
    const last = rows[rows.length - 1];
    const from = last?.tierTo != null ? last.tierTo + 1 : 1;
    setRows([
      ...rows,
      { key: `new-${Date.now()}`, id: null, tierFrom: from, tierTo: null, baseRate: 0 },
    ]);
  }
  function updateRow(key: string, field: keyof TierRowInput, value: number | null) {
    setRows(rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }
  function removeRow(row: LocalRow) {
    if (!row.id) {
      setRows((current) => current.filter((r) => r.key !== row.key));
      return;
    }
    startTransition(async () => {
      const res = await deleteRateTier(row.id!);
      if (res.error) setError(res.error);
      else setRows((current) => current.filter((r) => r.key !== row.key));
    });
  }
  function save() {
    startTransition(async () => {
      const res = await saveRateTiers(
        rateType,
        rows.map(({ id, tierFrom, tierTo, baseRate }) => ({ id, tierFrom, tierTo, baseRate })),
      );
      if (res.error) setError(res.error);
      else setError(null);
    });
  }

  return (
    <SettingsSection
      title={title}
      subtitle={subtitle}
      action={
        <button
          onClick={addRow}
          className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
        >
          + Add Tier
        </button>
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      {rateType === "base_dive" && (
        <InfoBox>
          When a diver crosses into a new tier, ALL previous dives this visit
          are repriced at the new rate automatically.
        </InfoBox>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          No tiers yet — add your first tier
        </div>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase">
              <th className="pb-2">From Dive</th>
              <th className="pb-2">To Dive</th>
              <th className="pb-2">{rateColumnLabel}</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-gray-100">
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    onFocus={(e) => e.currentTarget.select()}
                    value={row.tierFrom}
                    onChange={(e) => updateRow(row.key, "tierFrom", parseInt(e.target.value) || 0)}
                    className="w-20 border border-gray-300 rounded-md px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    onFocus={(e) => e.currentTarget.select()}
                    value={row.tierTo ?? ""}
                    placeholder="Above"
                    onChange={(e) =>
                      updateRow(row.key, "tierTo", e.target.value === "" ? null : parseInt(e.target.value) || 0)
                    }
                    className="w-20 border border-gray-300 rounded-md px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    onFocus={(e) => e.currentTarget.select()}
                    value={row.baseRate}
                    onChange={(e) => updateRow(row.key, "baseRate", parseFloat(e.target.value) || 0)}
                    className="w-28 border border-gray-300 rounded-md px-2 py-1"
                  />
                </td>
                <td className="py-2">
                  <button
                    onClick={() => removeRow(row)}
                    className="text-red text-xs hover:underline"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        onClick={save}
        disabled={pending || rows.length === 0}
        className="px-3 py-1.5 text-sm font-medium text-teal border border-teal rounded-md hover:bg-teal-light disabled:opacity-60"
      >
        {pending ? "Saving…" : `Save ${title}`}
      </button>
    </SettingsSection>
  );
}

export function TieredRatesSection({ tiers }: { tiers: RateTier[] }) {
  return (
    <>
      <TierTable
        rateType="base_dive"
        title="Base Rate Tiers"
        subtitle="Rate per dive — retroactive when threshold is crossed"
        rateColumnLabel="Rate per Dive (PHP)"
        allTiers={tiers}
      />
      <TierTable
        rateType="nitrox"
        title="Nitrox Rates"
        subtitle="Tiered add-on rate based on total number of dives"
        rateColumnLabel="Nitrox Rate (PHP)"
        allTiers={tiers}
      />
      <TierTable
        rateType="tank_15l"
        title="15L Tank Rates"
        subtitle="Tiered add-on rate for large tank requests"
        rateColumnLabel="15L Rate (PHP)"
        allTiers={tiers}
      />
    </>
  );
}
