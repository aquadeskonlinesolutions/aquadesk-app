"use client";

import { useState } from "react";
import { applyBundleToVisit } from "../actions";
import type { BundleOption } from "../data";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

// Matches the user's spec: shows the visit's completed (non-cancelled)
// dive count so the secretary can pick the matching configured Bundle
// (Settings > Courses > Bundles) — e.g. a diver with 6 logged dives picks
// the "6-Dive Package" bundle. Styled like this codebase's other diver-form
// modals (RateSelectModal).
export function ApplyBundleModal({
  diverId,
  visitId,
  diveCount,
  bundles,
  onClose,
  onApplied,
}: {
  diverId: string;
  visitId: string;
  diveCount: number;
  bundles: BundleOption[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [bundleId, setBundleId] = useState(bundles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!bundleId) {
      setError("Pick a bundle to apply.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await applyBundleToVisit(diverId, visitId, bundleId);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onApplied();
  }

  const selected = bundles.find((b) => b.id === bundleId);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-xl text-navy">Apply Bundle</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="px-6 py-4">
          <div className="text-sm text-gray-600 mb-4">
            This visit has <span className="font-semibold text-navy">{diveCount}</span> dive
            {diveCount === 1 ? "" : "s"} logged. Pick the bundle to apply — every dive rate on this
            visit will be zeroed and replaced with the bundle&apos;s flat price on the last row.
          </div>

          {error && <div className="text-sm text-red mb-3">{error}</div>}

          <div className="grid gap-2 mb-3">
            {bundles.map((b) => (
              <label
                key={b.id}
                className={`flex items-center justify-between border rounded-lg px-3 py-2 text-sm cursor-pointer ${
                  bundleId === b.id ? "border-teal bg-teal-light" : "border-gray-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" checked={bundleId === b.id} onChange={() => setBundleId(b.id)} />
                  {b.name}
                  <span className="text-xs text-gray-400">
                    ({b.diveCount} dive{b.diveCount === 1 ? "" : "s"})
                  </span>
                </span>
                <span className="font-medium text-navy">{peso(b.price)}</span>
              </label>
            ))}
          </div>

          {selected && !selected.equipmentIncluded && (
            <div className="text-xs text-orange mb-3">
              Equipment isn&apos;t included in this bundle &mdash; it will be priced separately and
              added to the last row.
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !bundleId}
              className="px-4 py-1.5 text-sm font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-60"
            >
              {saving ? "Applying…" : "Apply Bundle"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
