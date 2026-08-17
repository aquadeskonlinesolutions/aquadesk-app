"use server";

import { requireOwner } from "@/lib/dal";
import { getPaddleInstance } from "@/lib/paddle/server";

const MONTHLY_PRICE_ID = "pri_01m05n3arvpxce4d910jpbqxn6";
const ANNUAL_PRICE_ID = "pri_01m05n3av5d8bgbsdwpn8q781j";

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
  const priceId = plan === "monthly" ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID;

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
