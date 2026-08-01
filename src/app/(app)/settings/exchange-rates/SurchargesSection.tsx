"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveSurcharges } from "./actions";
import type { Surcharges } from "./data";

export function SurchargesSection({ surcharges }: { surcharges: Surcharges }) {
  const [card, setCard] = useState(String(surcharges.card));
  const [online, setOnline] = useState(String(surcharges.online));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveSurcharges(parseFloat(card) || 0, parseFloat(online) || 0);
      if (res.error) setError(res.error);
      else setError(null);
    });
  }

  return (
    <SettingsSection
      title="Payment Surcharges"
      subtitle="Auto-added to bill when payment method is selected"
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      <div className="flex flex-wrap gap-6 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credit Card Surcharge (%)
          </label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            step="0.1"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Online Payment Surcharge (%)
          </label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            step="0.1"
            value={online}
            onChange={(e) => setOnline(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Surcharges"}
      </button>
    </SettingsSection>
  );
}
