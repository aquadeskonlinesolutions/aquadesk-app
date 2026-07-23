"use client";

import { useActionState } from "react";
import { setPassword } from "@/lib/actions/account";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>
      {state?.error && <p className="text-sm text-red">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-card bg-navy text-white py-2 text-sm font-medium hover:bg-navy-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
