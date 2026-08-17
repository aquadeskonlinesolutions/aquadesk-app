// Build-time-only flags (NEXT_PUBLIC_* is inlined at build time, not read at
// request time) — flipping one means a rebuild + redeploy, not a runtime
// toggle. Safe to import from both client and server components; no
// "use client"/"use server"/server-only directive since it's neither.

// The live Paddle account isn't verified yet — this keeps the Subscription
// tab (and its checkout flow) hidden from real users so nobody hits a
// sandbox checkout with a real card, without touching any per-dive-center
// DB state. Explicit "true" string check, not just truthiness, so anything
// other than the literal string "true" (including unset) defaults to hidden.
export function isSubscriptionTabEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SUBSCRIPTION_TAB_ENABLED === "true";
}
