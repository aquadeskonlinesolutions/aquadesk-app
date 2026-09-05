// Live in-progress payment-breakdown calculation from form inputs (cash/
// card/online amounts, foreign currency, surcharge rates) — deliberately
// separate from src/lib/payments.ts's getPaidAmount/safeNum, which read
// *already-saved* payment rows. Different shape, not worth forcing together
// (matches this project's existing precedent of duplicating small pure
// helpers like peso() across files rather than over-centralizing).

export type PaymentInput = {
  cashAmount: number;
  cashAmountForeign: number;
  cashCurrencyCode: string | null;
  cashExchangeRate: number;
  cardAmount: number;
  onlineAmount: number;
  // Holds a base PaymentChannel key (e.g. "wise"), "custom" (an existing
  // per-dive-center channel, identified by customOnlineChannelId), or the
  // transient ADD_CHANNEL_VALUE sentinel while composing a brand-new one
  // via "+ Add Channel" (identified by newOnlineChannelLabel) — loosened
  // to plain string rather than PaymentChannel so this UI-only sentinel
  // doesn't need to leak into the shared payment-channel type. The
  // BillSummary component resolves ADD_CHANNEL_VALUE to "custom" before
  // ever calling a server action.
  onlineChannel: string | null;
  customOnlineChannelId: string | null;
  newOnlineChannelLabel: string;
  discount: number;
  notes: string;
};

export type PaymentBreakdown = PaymentInput & {
  cashForeignPHP: number;
  cardSurchargeRate: number;
  cardSurchargeAmount: number;
  onlineSurchargeRate: number;
  onlineSurchargeAmount: number;
  totalSurcharge: number;
  totalCollected: number;
  excessAmount: number;
};

export function computePaymentBreakdown(
  input: PaymentInput,
  cardSurchargeRate: number,
  onlineSurchargeRate: number,
  // What's actually still owed on this bill (grandTotal - discount -
  // depositsTotal) — required so totalCollected can be capped to it. Foreign
  // cash in particular is handed over in whole bills/denominations, so it
  // routinely overshoots what's owed (e.g. a ₱11,500 bill paid with $210 at
  // ₱57 = ₱11,970). Per the explicit decision behind this cap: the excess is
  // real (change handed back, occasionally a tip) but deliberately never
  // tracked — end-of-day reconciliation should match exactly what was
  // billed, no more, no less, not what was physically tendered.
  amountOwed: number,
): PaymentBreakdown {
  const cashForeignPHP = input.cashAmountForeign * input.cashExchangeRate;
  const cardSurchargeAmount = input.cardAmount * cardSurchargeRate;
  const onlineSurchargeAmount = input.onlineAmount * onlineSurchargeRate;
  const totalSurcharge = cardSurchargeAmount + onlineSurchargeAmount;
  const totalTendered =
    input.cashAmount + cashForeignPHP + input.cardAmount + cardSurchargeAmount + input.onlineAmount + onlineSurchargeAmount;
  const cappedOwed = Math.max(0, amountOwed);
  const totalCollected = Math.min(totalTendered, cappedOwed);
  // What was physically handed over beyond what's billed — real money, but
  // deliberately never counted as revenue (see the comment on `amountOwed`
  // above). Tracked as its own figure rather than silently dropped, so it
  // can be shown consistently instead of vanishing from every reconciliation.
  const excessAmount = Math.max(0, totalTendered - cappedOwed);

  return {
    ...input,
    cashForeignPHP,
    cardSurchargeRate,
    cardSurchargeAmount,
    onlineSurchargeRate,
    onlineSurchargeAmount,
    totalSurcharge,
    totalCollected,
    excessAmount,
  };
}
