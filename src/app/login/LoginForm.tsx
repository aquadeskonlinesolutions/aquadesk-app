"use client";

import { useActionState, useState } from "react";
import { signIn, requestPasswordReset } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, undefined);
  const [showForgot, setShowForgot] = useState(false);

  if (showForgot) {
    return (
      <form action={resetAction} className="space-y-4">
        <p className="text-sm text-gray-500">
          Enter your account email and we&apos;ll send you a link to reset your password.
        </p>
        <div>
          <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="reset-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        {resetState?.error && <p className="text-sm text-red">{resetState.error}</p>}
        {resetState?.message && <p className="text-sm text-green">{resetState.message}</p>}
        <button
          type="submit"
          disabled={resetPending}
          className="w-full rounded-card bg-navy text-white py-2 text-sm font-medium hover:bg-navy-dark transition-colors disabled:opacity-60"
        >
          {resetPending ? "Sending…" : "Send reset link"}
        </button>
        <button
          type="button"
          onClick={() => setShowForgot(false)}
          className="w-full text-sm text-gray-500 hover:text-navy"
        >
          ← Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-card bg-navy text-white py-2 text-sm font-medium hover:bg-navy-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => setShowForgot(true)}
        className="w-full text-sm text-gray-500 hover:text-navy"
      >
        Forgot password?
      </button>
    </form>
  );
}
