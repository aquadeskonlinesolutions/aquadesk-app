"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useEffect, useState } from "react";
import { SettingsSection, InfoBox } from "@/components/settings/SettingsSection";
import { Button } from "@/components/ui/Button";

const MONTHLY_PRICE_ID = "pri_01m05n3arvpxce4d910jpbqxn6";
const ANNUAL_PRICE_ID = "pri_01m05n3av5d8bgbsdwpn8q781j";

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
  diveCenterId,
  userId,
  email,
  subscriptionStatus,
}: {
  diveCenterId: string;
  userId: string;
  email: string;
  subscriptionStatus: string;
}) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("monthly");

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

  function openCheckout() {
    const priceId = selectedPlan === "monthly" ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID;
    paddle?.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email },
      customData: {
        aquadesk_dive_center_id: diveCenterId,
        aquadesk_user_id: userId,
      },
      settings: { variant: "one-page" },
    });
  }

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

      <InfoBox>ℹ️ Choose a plan below to subscribe or change your billing cycle.</InfoBox>

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

      <Button onClick={openCheckout} disabled={!paddle}>
        {paddle ? `Subscribe — ${selectedPlan === "monthly" ? "Monthly" : "Annual"}` : "Loading…"}
      </Button>
    </SettingsSection>
  );
}
