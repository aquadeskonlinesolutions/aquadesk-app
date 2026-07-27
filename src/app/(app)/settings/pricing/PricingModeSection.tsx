"use client";

import { useState, useTransition } from "react";
import { SettingsSection, WarningBox, InfoBox } from "@/components/settings/SettingsSection";
import { confirmPricingMode, switchPricingMode } from "./actions";
import type { PricingMode } from "./data";

const MODES: { value: "package" | "tier"; icon: string; title: string; desc: string }[] = [
  {
    value: "package",
    icon: "📦",
    title: "Package Based",
    desc: "Fixed price per trip or activity. One charge per diver regardless of number of dives.",
  },
  {
    value: "tier",
    icon: "📊",
    title: "Tier Rate Based",
    desc: "Rate per dive that decreases as diver does more dives. Retroactive repricing when tier is crossed.",
  },
];

export function PricingModeSection({
  pricingMode,
  hasOwnerPassword,
}: {
  pricingMode: PricingMode;
  hasOwnerPassword: boolean;
}) {
  const [selected, setSelected] = useState<"package" | "tier" | null>(null);
  const [switching, setSwitching] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    if (!selected) return;
    startTransition(async () => {
      const res = await confirmPricingMode(selected);
      if (res.error) setError(res.error);
      else setError(null);
    });
  }

  function handleSwitch() {
    if (!hasOwnerPassword) {
      setError("Set your owner password first, under Passwords.");
      return;
    }
    setSwitching(true);
    setError(null);
    setPassword("");
  }

  function handleConfirmSwitch() {
    startTransition(async () => {
      const res = await switchPricingMode(password);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setSwitching(false);
      }
    });
  }

  return (
    <SettingsSection
      title="Pricing Mode"
      subtitle="Choose once — locked after confirmation"
      action={
        pricingMode && !switching ? (
          <button
            onClick={handleSwitch}
            className="px-3 py-1.5 text-xs font-medium text-navy border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            🔒 Change Pricing Mode
          </button>
        ) : undefined
      }
    >
      {error && <div className="mb-4 text-sm text-red">{error}</div>}

      {!pricingMode && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setSelected(m.value)}
                className={`text-left border-2 rounded-card p-5 transition-colors ${
                  selected === m.value
                    ? "border-teal bg-teal-light"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-2xl mb-2">{m.icon}</div>
                <div className="font-semibold text-navy mb-1">{m.title}</div>
                <div className="text-sm text-gray-600">{m.desc}</div>
              </button>
            ))}
          </div>
          {selected && (
            <button
              onClick={handleConfirm}
              disabled={pending}
              className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid transition-colors disabled:opacity-60"
            >
              {pending ? "Confirming…" : `Confirm Pricing Mode →`}
            </button>
          )}
        </>
      )}

      {pricingMode && !switching && (
        <WarningBox>
          🔒 Current Pricing Mode:{" "}
          <strong>{pricingMode === "package" ? "Package Based" : "Tier Based"}</strong>.
          This is locked after setup so secretaries cannot accidentally change
          billing behavior. Use Change Pricing Mode and your owner password only
          when the dive center officially switches pricing method.
        </WarningBox>
      )}

      {switching && (
        <div className="max-w-sm">
          <InfoBox>
            Switching requires all open bills to be closed first, and your
            owner password.
          </InfoBox>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirmSwitch}
              disabled={pending}
              className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
            >
              {pending ? "Switching…" : "Confirm Switch"}
            </button>
            <button
              onClick={() => setSwitching(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-navy"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
