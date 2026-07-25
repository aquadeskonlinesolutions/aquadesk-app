"use client";

import { useState, useTransition } from "react";
import { unlockBill } from "../actions";

export function BillUnlockModal({
  diverId,
  visitId,
  onClose,
  onUnlocked,
}: {
  diverId: string;
  visitId: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await unlockBill(diverId, visitId, password);
      if (res.error) setError(res.error);
      else onUnlocked();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-xl text-navy">Unlock Bill</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-6 grid gap-3">
          <p className="text-sm text-gray-600">
            Reopening a closed bill requires the billing password. This is logged for audit purposes.
          </p>
          {error && <div className="text-sm text-red">{error}</div>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Billing password"
            className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
          />
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !password}
            className="px-4 py-2 bg-red text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Verifying…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
