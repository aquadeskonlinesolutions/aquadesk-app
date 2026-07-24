"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveFuelSettings, resetFuelConsumed } from "./actions";
import type { FuelSettings } from "./data";

export function FuelSection({ fuel }: { fuel: FuelSettings }) {
  const [gasolineLevel, setGasolineLevel] = useState(
    fuel.gasolineLevel != null ? String(fuel.gasolineLevel) : "",
  );
  const [gasolineThreshold, setGasolineThreshold] = useState(
    fuel.gasolineThreshold != null ? String(fuel.gasolineThreshold) : "",
  );
  const [dieselLevel, setDieselLevel] = useState(
    fuel.dieselLevel != null ? String(fuel.dieselLevel) : "",
  );
  const [dieselThreshold, setDieselThreshold] = useState(
    fuel.dieselThreshold != null ? String(fuel.dieselThreshold) : "",
  );
  const [gasolineConsumed, setGasolineConsumed] = useState(fuel.gasolineConsumed);
  const [dieselConsumed, setDieselConsumed] = useState(fuel.dieselConsumed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveFuelSettings(
        gasolineLevel === "" ? null : parseFloat(gasolineLevel),
        gasolineThreshold === "" ? null : parseFloat(gasolineThreshold),
        dieselLevel === "" ? null : parseFloat(dieselLevel),
        dieselThreshold === "" ? null : parseFloat(dieselThreshold),
      );
      if (res.error) setError(res.error);
      else setError(null);
    });
  }

  function reset(type: "gasoline" | "diesel") {
    startTransition(async () => {
      const res = await resetFuelConsumed(type);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      if (type === "gasoline") setGasolineConsumed(0);
      else setDieselConsumed(0);
    });
  }

  return (
    <SettingsSection
      title="Fuel"
      subtitle="Secretary updates current level manually after refueling"
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase">
            <th className="pb-2">Fuel Type</th>
            <th className="pb-2">Current Level (L)</th>
            <th className="pb-2">Low Alert Threshold (L)</th>
            <th className="pb-2">Consumed (L)</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-gray-100">
            <td className="py-2 pr-2 font-medium text-navy">Gasoline</td>
            <td className="py-2 pr-2">
              <input
                type="number"
                min={0}
                value={gasolineLevel}
                onChange={(e) => setGasolineLevel(e.target.value)}
                placeholder="e.g. 200"
                className="w-24 border border-gray-300 rounded-md px-2 py-1"
              />
            </td>
            <td className="py-2 pr-2">
              <input
                type="number"
                min={0}
                value={gasolineThreshold}
                onChange={(e) => setGasolineThreshold(e.target.value)}
                placeholder="e.g. 50"
                className="w-24 border border-gray-300 rounded-md px-2 py-1"
              />
            </td>
            <td className="py-2 pr-2">
              <input
                type="text"
                readOnly
                value={gasolineConsumed.toFixed(2)}
                className="w-24 border border-gray-200 bg-gray-100 text-gray-600 rounded-md px-2 py-1"
              />
            </td>
            <td className="py-2">
              <button
                onClick={() => reset("gasoline")}
                disabled={pending}
                className="text-xs text-navy border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-100"
              >
                Reset
              </button>
            </td>
          </tr>
          <tr className="border-t border-gray-100">
            <td className="py-2 pr-2 font-medium text-navy">Diesel</td>
            <td className="py-2 pr-2">
              <input
                type="number"
                min={0}
                value={dieselLevel}
                onChange={(e) => setDieselLevel(e.target.value)}
                placeholder="e.g. 200"
                className="w-24 border border-gray-300 rounded-md px-2 py-1"
              />
            </td>
            <td className="py-2 pr-2">
              <input
                type="number"
                min={0}
                value={dieselThreshold}
                onChange={(e) => setDieselThreshold(e.target.value)}
                placeholder="e.g. 50"
                className="w-24 border border-gray-300 rounded-md px-2 py-1"
              />
            </td>
            <td className="py-2 pr-2">
              <input
                type="text"
                readOnly
                value={dieselConsumed.toFixed(2)}
                className="w-24 border border-gray-200 bg-gray-100 text-gray-600 rounded-md px-2 py-1"
              />
            </td>
            <td className="py-2">
              <button
                onClick={() => reset("diesel")}
                disabled={pending}
                className="text-xs text-navy border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-100"
              >
                Reset
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <button
        onClick={save}
        disabled={pending}
        className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Fuel Settings"}
      </button>
    </SettingsSection>
  );
}
