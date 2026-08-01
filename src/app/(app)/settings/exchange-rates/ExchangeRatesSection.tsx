"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveExchangeRates, addCustomCurrency, type ExchangeRateInput } from "./actions";
import type { ExchangeRate } from "./data";
import { DEFAULT_CURRENCIES } from "./constants";

type Row = {
  code: string;
  name: string;
  flag: string;
  rate: string;
  active: boolean;
  isDefault: boolean;
};

function buildRows(rates: ExchangeRate[]): Row[] {
  const defaults: Row[] = DEFAULT_CURRENCIES.map((d) => {
    const found = rates.find((r) => r.currency_code === d.code);
    return {
      code: d.code,
      name: d.name,
      flag: d.flag,
      rate: String(found?.rate_to_php ?? d.rate),
      active: found?.is_active ?? true,
      isDefault: true,
    };
  });
  const custom: Row[] = rates
    .filter((r) => !DEFAULT_CURRENCIES.some((d) => d.code === r.currency_code))
    .map((r) => ({
      code: r.currency_code,
      name: "Custom Currency",
      flag: "💱",
      rate: String(r.rate_to_php),
      active: r.is_active,
      isDefault: false,
    }));
  return [...defaults, ...custom];
}

export function ExchangeRatesSection({ rates }: { rates: ExchangeRate[] }) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(rates));
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newRate, setNewRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateRow(code: string, patch: Partial<Row>) {
    setRows(rows.map((r) => (r.code === code ? { ...r, ...patch } : r)));
  }

  function save() {
    startTransition(async () => {
      const payload: ExchangeRateInput[] = rows.map((r) => ({
        currencyCode: r.code,
        rateToPhp: parseFloat(r.rate) || 0,
        isActive: r.active,
      }));
      const res = await saveExchangeRates(payload);
      if (res.error) setError(res.error);
      else setError(null);
    });
  }

  function saveCustom() {
    startTransition(async () => {
      const res = await addCustomCurrency(newCode, parseFloat(newRate) || 0);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setAdding(false);
        setNewCode("");
        setNewRate("");
        setRows((current) => [
          ...current,
          {
            code: newCode.trim().toUpperCase(),
            name: "Custom Currency",
            flag: "💱",
            rate: newRate,
            active: true,
            isDefault: false,
          },
        ]);
      }
    });
  }

  return (
    <SettingsSection
      title="Exchange Rates"
      subtitle="Auto-fills on Diver Form — secretary can still override per transaction"
      action={
        !adding && (
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Currency
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {adding && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Currency Code
            </label>
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-24 uppercase"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Rate (1 unit = PHP)
            </label>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              step="0.001"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-28"
            />
          </div>
          <button
            onClick={saveCustom}
            disabled={pending}
            className="px-3 py-1.5 text-sm font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
          >
            Save
          </button>
          <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-sm text-gray-600">
            Cancel
          </button>
        </div>
      )}

      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase">
            <th className="pb-2">Currency</th>
            <th className="pb-2">Rate (1 unit = PHP)</th>
            <th className="pb-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t border-gray-100">
              <td className="py-2 pr-2">
                <span className="mr-1.5">{r.flag}</span>
                <strong>{r.code}</strong> — {r.name}
              </td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  onFocus={(e) => e.currentTarget.select()}
                  step="0.001"
                  value={r.rate}
                  onChange={(e) => updateRow(r.code, { rate: e.target.value })}
                  className="w-28 border border-gray-300 rounded-md px-2 py-1"
                />
              </td>
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={(e) => updateRow(r.code, { active: e.target.checked })}
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
        {pending ? "Saving…" : "Save All Rates"}
      </button>
    </SettingsSection>
  );
}
