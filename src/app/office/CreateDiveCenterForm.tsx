"use client";

import { useActionState } from "react";
import { createDiveCenter } from "@/lib/actions/office";

export function CreateDiveCenterForm() {
  const [state, action, pending] = useActionState(createDiveCenter, undefined);

  return (
    <div className="bg-white rounded-card shadow-card border border-gray-200 p-6">
      <h2 className="font-display text-lg text-navy mb-4">
        Create dive center
      </h2>

      {state?.tempPassword && (
        <div className="mb-4 rounded-card bg-green-light border border-green/30 p-4 text-sm">
          <p className="font-medium text-green mb-1">
            {state.diveCenterName} created.
          </p>
          <p className="text-gray-700">
            Temporary owner password (shown once — give this to the owner,
            they&apos;ll be forced to change it on first login):
          </p>
          <code className="block mt-2 font-mono text-sm bg-white border border-gray-200 rounded px-2 py-1 break-all">
            {state.tempPassword}
          </code>
        </div>
      )}
      {state?.error && (
        <p className="mb-4 text-sm text-red">{state.error}</p>
      )}

      <form action={action} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dive center name
          </label>
          <input
            name="name"
            required
            className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Business email
          </label>
          <input
            name="email"
            type="email"
            className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            name="phone"
            className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            name="address"
            className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner full name
          </label>
          <input
            name="ownerName"
            required
            className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner login email
          </label>
          <input
            name="ownerEmail"
            type="email"
            required
            className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pricing mode
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Confirm with the dive center before creating the account — this
            can only be changed later by the owner, under Settings, and only
            while no bills are open.
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name="pricingMode" value="tier" required />
              Tier-based (per-dive rates by cumulative dive count)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name="pricingMode" value="package" required />
              Package-based (flat price per dive-site combination)
            </label>
          </div>
        </div>
        <div className="col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-card bg-navy text-white px-4 py-2 text-sm font-medium hover:bg-navy-dark transition-colors disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create dive center"}
          </button>
        </div>
      </form>
    </div>
  );
}
