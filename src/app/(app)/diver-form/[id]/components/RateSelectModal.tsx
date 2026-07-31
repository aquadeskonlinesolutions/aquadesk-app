"use client";

import { useState } from "react";
import { saveRateSelectionsAndApply, type AmbiguousPackageGroup } from "../actions";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

type Answer = { siteKey: string; packageId: string | null; customPrice: number | null };

// Matches diver-form.html's real openRateSelectModal/resolvePackageGroupRates:
// a promise-style, one-step-per-ambiguous-site-combo picker (a matching
// package, or a custom price) — only shown when a combo matches 0 or 2+
// active packages. Styled like this app's existing ConfirmDialog.tsx chrome.
export function RateSelectModal({
  diverId,
  visitId,
  groups,
  initialAnswers,
  onClose,
  onApplied,
}: {
  diverId: string;
  visitId: string;
  groups: AmbiguousPackageGroup[];
  initialAnswers?: Record<string, Answer>;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(initialAnswers ?? {});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const group = groups[step];
  const current = answers[group.siteKey];
  const customInput = current && current.packageId === null && current.customPrice !== null ? String(current.customPrice) : "";

  function choosePackage(packageId: string) {
    setAnswers((a) => ({ ...a, [group.siteKey]: { siteKey: group.siteKey, packageId, customPrice: null } }));
  }

  function setCustom(value: string) {
    const num = Number(value);
    if (value !== "" && Number.isFinite(num) && num >= 0) {
      setAnswers((a) => ({ ...a, [group.siteKey]: { siteKey: group.siteKey, packageId: null, customPrice: num } }));
    } else {
      setAnswers((a) => {
        const next = { ...a };
        delete next[group.siteKey];
        return next;
      });
    }
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await saveRateSelectionsAndApply(diverId, visitId, Object.values(answers));
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onApplied();
  }

  function next() {
    if (!answers[group.siteKey]) {
      setError("Pick a package or enter a custom price before continuing.");
      return;
    }
    setError(null);
    if (step < groups.length - 1) {
      setStep(step + 1);
    } else {
      submit();
    }
  }

  function back() {
    setError(null);
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="font-display text-xl text-navy">Which package applies?</div>
            {groups.length > 1 && <div className="text-xs text-gray-400 mt-0.5">{step + 1} of {groups.length}</div>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="px-6 py-4">
          <div className="text-sm text-gray-700 mb-1">{group.sites}</div>
          {group.dates.length > 0 && (
            <div className="text-xs text-gray-400 mb-3">{group.dates.join(", ")}</div>
          )}
          {error && <div className="text-sm text-red mb-3">{error}</div>}
          {group.matches.length === 0 ? (
            <div className="text-xs text-gray-400 mb-3">
              No packages configured for this exact site combination — enter a custom price below.
            </div>
          ) : (
            <div className="grid gap-2 mb-3">
              {group.matches.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center justify-between border rounded-lg px-3 py-2 text-sm cursor-pointer ${
                    current?.packageId === m.id ? "border-teal bg-teal-light" : "border-gray-200"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" checked={current?.packageId === m.id} onChange={() => choosePackage(m.id)} />
                    {m.packageName}
                  </span>
                  <span className="font-medium text-navy">{peso(m.price)}</span>
                </label>
              ))}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Custom price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={customInput}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={step > 0 ? back : onClose} className="px-4 py-2 text-sm text-gray-600">
            {step > 0 ? "← Back" : "Cancel"}
          </button>
          <button
            onClick={next}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-navy hover:bg-navy-dark disabled:opacity-60"
          >
            {saving ? "Applying…" : step < groups.length - 1 ? "Next →" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
