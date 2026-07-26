"use client";

import { useActionState, useEffect } from "react";
import { startBilling } from "@/lib/actions/office";

export function StartBillingForm({
  diveCenterId,
  diveCenterName,
  onClose,
}: {
  diveCenterId: string;
  diveCenterName: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(startBilling.bind(null, diveCenterId), undefined);

  useEffect(() => {
    if (state && !state.error) onClose();
  }, [state, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-card-lg shadow-card border border-gray-200 p-6 w-full max-w-sm">
        <h2 className="font-display text-lg text-navy mb-1">Start Billing</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ends {diveCenterName}&apos;s free trial and sets the first due date.
        </p>
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First due date</label>
            <input
              name="dueDate"
              type="date"
              required
              className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly amount (₱)</label>
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              defaultValue={4000}
              required
              className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          {state?.error && <p className="text-sm text-red">{state.error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-navy"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 rounded-card bg-navy text-white text-sm font-medium hover:bg-navy-dark transition-colors disabled:opacity-60"
            >
              {pending ? "Starting…" : "Start Billing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
