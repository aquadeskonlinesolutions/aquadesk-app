"use server";

import { requireOwner } from "@/lib/dal";
import { getPaddleInstance } from "@/lib/paddle/server";

// Sandbox and live are separate Paddle accounts with separate price IDs -
// keyed by NEXT_PUBLIC_PADDLE_ENV (same var getPaddleInstance() gates on)
// rather than hardcoding one environment's IDs, so this keeps working in
// both local sandbox dev and a live build without a code change to swap.
const PRICE_IDS = {
  sandbox: {
    monthly: "pri_01m05n3arvpxce4d910jpbqxn6",
    annual: "pri_01m05n3av5d8bgbsdwpn8q781j",
  },
  production: {
    monthly: "pri_01m09hhte5a3xqf0wbecr5q2jw",
    annual: "pri_01m09hhtq4h5hcvz6ayesta107",
  },
} as const satisfies Record<string, { monthly: string; annual: string }>;

// The dive center a checkout activates is security-sensitive - it must never
// be something the browser can influence. Paddle's webhook signature only
// proves Paddle relayed a payload unchanged, not that the customData inside
// it was truthful, so customData can't be set client-side (the previous
// Checkout.open({ items, customData }) call let anyone edit
// aquadesk_dive_center_id in DevTools before paying and hijack another dive
// center's subscription). Creating the transaction here instead, from the
// authenticated session's own diveCenterId/id, makes customData authoritative
// - the client only ever receives an opaque transactionId back.
export async function createSubscriptionCheckoutTransaction(
  plan: "monthly" | "annual",
): Promise<{ transactionId: string } | { error: string }> {
  const user = await requireOwner();
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV;
  if (env !== "sandbox" && env !== "production") {
    throw new Error(`NEXT_PUBLIC_PADDLE_ENV must be "sandbox" or "production", got: ${env}`);
  }
  const priceId = PRICE_IDS[env][plan];

  const paddle = getPaddleInstance();
  try {
    const transaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customData: {
        aquadesk_dive_center_id: user.diveCenterId,
        aquadesk_user_id: user.id,
      },
    });
    return { transactionId: transaction.id };
  } catch (e) {
    console.error("Failed to create Paddle checkout transaction:", e);
    return { error: "Could not start checkout. Please try again." };
  }
}
