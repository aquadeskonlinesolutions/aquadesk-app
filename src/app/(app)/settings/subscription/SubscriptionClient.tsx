"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useEffect, useState } from "react";
import { SettingsSection, InfoBox } from "@/components/settings/SettingsSection";
import { Button } from "@/components/ui/Button";
import { createSubscriptionCheckoutTransaction } from "./actions";

type Plan = "monthly" | "annual";

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  trial: "bg-orange-light text-orange",
  active: "bg-teal-light text-teal-mid",
  suspended: "bg-red-light text-red",
  cancelled: "bg-gray-100 text-gray-600",
};

export function SubscriptionClient({
  email,
  subscriptionStatus,
}: {
  email: string;
  subscriptionStatus: string;
}) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("monthly");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
      !process.env.NEXT_PUBLIC_PADDLE_ENV
    ) {
      return;
    }
    initializePaddle({
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production",
    }).then((p) => p && setPaddle(p));
  }, []);

  async function openCheckout() {
    if (!paddle) return;
    setError(null);
    setPending(true);
    // The transaction (and the customData that determines which dive center
    // this checkout credits) is created server-side from the authenticated
    // session, never from anything this client sends — see actions.ts for why.
    const res = await createSubscriptionCheckoutTransaction(selectedPlan);
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

  const alreadyActive = subscriptionStatus === "active";

  return (
    <SettingsSection
      title="Subscription"
      subtitle="Your AquaDesk plan status and billing"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Current status:</span>
        <span
          className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
            STATUS_BADGE_CLASSES[subscriptionStatus] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {SUBSCRIPTION_LABELS[subscriptionStatus] ?? subscriptionStatus}
        </span>
      </div>

      {alreadyActive ? (
        <InfoBox>
          ℹ️ You already have an active subscription. Contact AquaDesk support to change your
          plan or billing cycle.
        </InfoBox>
      ) : (
        <>
          <InfoBox>ℹ️ Choose a plan below to subscribe.</InfoBox>

          {error && <div className="mb-3 text-sm text-red">{error}</div>}

          <div className="grid grid-cols-2 gap-4 mb-5 max-w-lg">
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              className={`text-left border rounded-lg px-4 py-3 transition-colors ${
                selectedPlan === "monthly"
                  ? "border-navy bg-navy/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="text-sm font-semibold text-navy">Monthly</div>
              <div className="text-xs text-gray-500 mt-0.5">$65 / month</div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan("annual")}
              className={`text-left border rounded-lg px-4 py-3 transition-colors ${
                selectedPlan === "annual"
                  ? "border-navy bg-navy/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="text-sm font-semibold text-navy">Annual</div>
              <div className="text-xs text-gray-500 mt-0.5">$733 / year</div>
            </button>
          </div>

          <Button onClick={openCheckout} disabled={!paddle || pending}>
            {pending
              ? "Starting checkout…"
              : paddle
                ? `Subscribe — ${selectedPlan === "monthly" ? "Monthly" : "Annual"}`
                : "Loading…"}
          </Button>
        </>
      )}
    </SettingsSection>
  );
}
