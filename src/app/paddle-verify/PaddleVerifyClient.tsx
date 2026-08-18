"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useEffect, useState } from "react";
import { createSubscriptionCheckoutTransaction } from "@/app/(app)/settings/subscription/actions";

export function PaddleVerifyClient({ email }: { email: string }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
      !process.env.NEXT_PUBLIC_PADDLE_ENV
    ) {
      return;
    }
    // Initializing is enough on its own - Paddle.js auto-opens checkout when
    // it detects a _ptxn query param in the URL (Paddle's default payment
    // link behavior), no custom handling needed. This is what makes this
    // page valid to submit as both the default payment link and for domain
    // approval.
    initializePaddle({
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production",
    }).then((p) => p && setPaddle(p));
  }, []);

  async function startTestCheckout() {
    if (!paddle) return;
    setError(null);
    setPending(true);
    // Reuses the same server-hardened transaction-creation action the real
    // Subscription tab uses (see actions.ts) rather than a second copy -
    // customData is still derived from the authenticated session there,
    // never from this page.
    const res = await createSubscriptionCheckoutTransaction("monthly");
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    paddle.Checkout.open({
      transactionId: res.transactionId,
      customer: { email },
      settings: { variant: "one-page" },
    });
  }

  return (
    <div className="bg-white rounded-card-lg shadow-card border border-gray-200 p-8 max-w-md w-full">
      <h1 className="font-display text-xl text-navy mb-2">Paddle checkout verification</h1>
      <p className="text-sm text-gray-600 mb-6">
        Unlinked verification page — not reachable from anywhere in the
        app&apos;s navigation. Exists for Paddle&apos;s domain approval and as
        the default payment link, and to manually test a real checkout end to
        end before the Subscription tab is opened to real customers.
      </p>
      {error && <div className="mb-4 text-sm text-red">{error}</div>}
      <button
        type="button"
        onClick={startTestCheckout}
        disabled={!paddle || pending}
        className="w-full py-3 bg-navy text-white rounded-card font-medium text-sm hover:bg-navy-dark transition-colors disabled:opacity-50"
      >
        {pending ? "Starting checkout…" : paddle ? "Start test checkout (Monthly)" : "Loading…"}
      </button>
    </div>
  );
}
