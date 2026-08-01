"use client";

import { useState, useTransition } from "react";
import { SettingsSection, ChargeTypeToggle } from "@/components/settings/SettingsSection";
import {
  saveDefaultCharge,
  addCustomCharge,
  updateChargeAmount,
  deleteCharge,
} from "./actions";
import type { OtherCharge } from "./data";
import { DEFAULT_CHARGES } from "./constants";

type DefaultRow = {
  name: string;
  subType: string | null;
  amount: string;
  chargeType: "per_dive" | "per_day";
};

function findDefault(charges: OtherCharge[], name: string, subType: string | null) {
  return subType
    ? charges.find((c) => c.sub_type === subType)
    : charges.find((c) => c.charge_name === name && !c.sub_type);
}

export function OtherChargesSection({ charges }: { charges: OtherCharge[] }) {
  const [defaults, setDefaults] = useState<DefaultRow[]>(() =>
    DEFAULT_CHARGES.map((d) => {
      const existing = findDefault(charges, d.name, d.subType);
      return {
        name: d.name,
        subType: d.subType,
        amount: String(existing?.amount ?? 0),
        chargeType: existing?.charge_type ?? "per_dive",
      };
    }),
  );
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customType, setCustomType] = useState<"per_dive" | "per_day">("per_dive");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultNames = new Set(DEFAULT_CHARGES.map((d) => d.name));
  const customCharges = charges.filter((c) => !defaultNames.has(c.charge_name));

  function updateDefault(index: number, patch: Partial<DefaultRow>) {
    setDefaults(defaults.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function saveAll() {
    startTransition(async () => {
      for (const row of defaults) {
        const res = await saveDefaultCharge(
          row.name,
          row.subType,
          parseFloat(row.amount) || 0,
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
      const res = await addCustomCharge(customName, parseFloat(customAmount) || 0, customType);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setAddingCustom(false);
        setCustomName("");
        setCustomAmount("");
      }
    });
  }

  function updateCustom(id: string, amount: string) {
    startTransition(async () => {
      await updateChargeAmount(id, parseFloat(amount) || 0);
    });
  }

  function removeCustom(id: string) {
    startTransition(async () => {
      await deleteCharge(id);
    });
  }

  return (
    <SettingsSection
      title="Other Charges"
      subtitle="Added automatically when boat returns"
      action={
        !addingCustom && (
          <button
            onClick={() => setAddingCustom(true)}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Charge
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      <div className="flex flex-col gap-2 mb-4">
        {defaults.map((row, i) => (
          <div key={row.name} className="flex items-center gap-3">
            <span className="w-44 text-sm text-gray-700 shrink-0">{row.name}</span>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              value={row.amount}
              onChange={(e) => updateDefault(i, { amount: e.target.value })}
              className="w-28 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
            <ChargeTypeToggle
              value={row.chargeType}
              onChange={(v) => updateDefault(i, { chargeType: v })}
            />
          </div>
        ))}

        {customCharges.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <span className="w-44 text-sm text-gray-700 shrink-0">{c.charge_name}</span>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              defaultValue={c.amount}
              onBlur={(e) => updateCustom(c.id, e.target.value)}
              className="w-28 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => removeCustom(c.id)}
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
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
        {pending ? "Saving…" : "Save Charges"}
      </button>
    </SettingsSection>
  );
}
