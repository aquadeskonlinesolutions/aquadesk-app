"use client";

import { useState, useTransition } from "react";
import { SettingsSection, ChargeTypeToggle } from "@/components/settings/SettingsSection";
import {
  saveDefaultEquipmentRate,
  addCustomEquipmentRate,
  updateEquipmentRateAmount,
  deleteEquipmentRate,
} from "./actions";
import type { EquipmentRentalRate } from "./data";
import { DEFAULT_EQUIPMENT_ITEMS } from "./constants";

type DefaultRow = {
  name: string;
  rate: string;
  chargeType: "per_dive" | "per_day";
};

export function EquipmentRentalSection({ rates }: { rates: EquipmentRentalRate[] }) {
  const [defaults, setDefaults] = useState<DefaultRow[]>(() =>
    DEFAULT_EQUIPMENT_ITEMS.map((name) => {
      const existing = rates.find((r) => r.item_name === name);
      return {
        name,
        rate: String(existing?.rate ?? 0),
        chargeType: existing?.charge_type ?? "per_day",
      };
    }),
  );
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customRate, setCustomRate] = useState("");
  const [customType, setCustomType] = useState<"per_dive" | "per_day">("per_day");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultNames = new Set(DEFAULT_EQUIPMENT_ITEMS);
  const customRates = rates.filter((r) => !defaultNames.has(r.item_name));

  function updateDefault(index: number, patch: Partial<DefaultRow>) {
    setDefaults(defaults.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function saveAll() {
    startTransition(async () => {
      for (const row of defaults) {
        const res = await saveDefaultEquipmentRate(
          row.name,
          parseFloat(row.rate) || 0,
          row.chargeType,
        );
        if (res.error) {
          setError(res.error);
          return;
        }
      }
      setError(null);
    });
  }

  function saveCustom() {
    startTransition(async () => {
      const res = await addCustomEquipmentRate(
        customName,
        parseFloat(customRate) || 0,
        customType,
      );
      if (res.error) setError(res.error);
      else {
        setError(null);
        setAddingCustom(false);
        setCustomName("");
        setCustomRate("");
      }
    });
  }

  function updateCustom(id: string, rate: string) {
    startTransition(async () => {
      await updateEquipmentRateAmount(id, parseFloat(rate) || 0);
    });
  }

  function removeCustom(id: string) {
    startTransition(async () => {
      await deleteEquipmentRate(id);
    });
  }

  return (
    <SettingsSection
      title="Equipment Rental Rates"
      subtitle="Auto-added to bill when diver requested equipment on registration"
      action={
        !addingCustom && (
          <button
            onClick={() => setAddingCustom(true)}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Item
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      <div className="flex flex-col gap-2 mb-4">
        {defaults.map((row, i) => (
          <div key={row.name} className="flex items-center gap-3">
            <span className="w-32 text-sm text-gray-700 shrink-0">{row.name}</span>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              value={row.rate}
              onChange={(e) => updateDefault(i, { rate: e.target.value })}
              className="w-28 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
            <ChargeTypeToggle
              value={row.chargeType}
              onChange={(v) => updateDefault(i, { chargeType: v })}
            />
          </div>
        ))}

        {customRates.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <span className="w-32 text-sm text-gray-700 shrink-0">{r.item_name}</span>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              defaultValue={r.rate}
              onBlur={(e) => updateCustom(r.id, e.target.value)}
              className="w-28 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => removeCustom(r.id)}
              className="text-xs text-red hover:underline"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {addingCustom && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rate</label>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-28"
            />
          </div>
          <ChargeTypeToggle value={customType} onChange={setCustomType} />
          <button
            onClick={saveCustom}
            disabled={pending}
            className="px-3 py-1.5 text-sm font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
          >
            Save
          </button>
          <button
            onClick={() => setAddingCustom(false)}
            className="px-3 py-1.5 text-sm text-gray-600"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        onClick={saveAll}
        disabled={pending}
        className="px-3 py-1.5 text-sm font-medium text-teal border border-teal rounded-md hover:bg-teal-light disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Equipment Rates"}
      </button>
    </SettingsSection>
  );
}
