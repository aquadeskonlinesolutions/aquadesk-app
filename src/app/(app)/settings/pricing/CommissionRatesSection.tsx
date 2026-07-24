"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveCommissionRates } from "./actions";
import type { CommissionRates } from "./data";

export function CommissionRatesSection({ rates }: { rates: CommissionRates }) {
  const [divemasterRate, setDivemasterRate] = useState(String(rates.divemasterRatePerDive));
  const [ratioBonusEnabled, setRatioBonusEnabled] = useState(rates.ratioBonusEnabled);
  const [ratioBonusExtraRate, setRatioBonusExtraRate] = useState(String(rates.ratioBonusExtraRate));
  const [joinRideRate, setJoinRideRate] = useState(String(rates.joinRideRatePerDiverPerDive));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveCommissionRates(
        parseFloat(divemasterRate) || 0,
        ratioBonusEnabled,
        parseFloat(ratioBonusExtraRate) || 0,
        parseFloat(joinRideRate) || 0,
      );
      if (res.error) setError(res.error);
      else setError(null);
    });
  }

  return (
    <SettingsSection
      title="Staff Commission & Join Ride Rates"
      subtitle="Used in Reports > Staff Activity Summary and Join Ride — the same rate for every staff member, in-house or freelance"
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Divemaster Rate (₱ per dive led)
        </label>
        <input
          type="number"
          min={0}
          value={divemasterRate}
          onChange={(e) => setDivemasterRate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
        />
        <p className="text-xs text-gray-500 mt-1">
          Applied automatically per completed dive in Staff Activity Summary — still editable per line there if
          needed.
        </p>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Ratio Bonus</label>
        <div className="inline-flex border border-gray-200 rounded-md overflow-hidden mb-2">
          {[
            { label: "Off", value: false },
            { label: "On", value: true },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setRatioBonusEnabled(opt.value)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                ratioBonusEnabled === opt.value
                  ? "bg-navy text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-2">
          When on, Staff Activity Summary flags any dive group over 4 divers and offers a manual bonus field for
          that line — there&apos;s no automatic formula, since not every dive center pays extra and the amount
          varies.
        </p>
        {ratioBonusEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extra Rate (₱, reference only)
            </label>
            <input
              type="number"
              min={0}
              value={ratioBonusExtraRate}
              onChange={(e) => setRatioBonusExtraRate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
            />
            <p className="text-xs text-gray-500 mt-1">
              Pre-fills the manual bonus field as a starting point — always editable per line, never applied
              automatically.
            </p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Join Ride Rate (₱ per diver per dive)
        </label>
        <input
          type="number"
          min={0}
          value={joinRideRate}
          onChange={(e) => setJoinRideRate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
        />
      </div>

      <button
        onClick={save}
        disabled={pending}
        className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Rates"}
      </button>
    </SettingsSection>
  );
}
