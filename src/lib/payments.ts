// Shared between Dashboard and Reports — both need "how much has actually
// been collected against this bill so far" from a payments row.

// The required sub-choice whenever a payment method is "online" — shared
// across every place that records a payment method (bill payment,
// deposits, expenses, join ride settlement, rental gear settlement, staff
// commission payout). Matches the public.payment_channel Postgres enum
// exactly (database/043_online_payment_channel.sql, plus 'custom' added
// by 046_custom_payment_channels.sql for per-dive-center custom channels
// — see lib/paymentChannels.ts's resolveOnlineChannel).
export type BasePaymentChannel = "e_wallet" | "paypal" | "wise" | "bank";
export type PaymentChannel = BasePaymentChannel | "custom";

export const PAYMENT_CHANNEL_LABELS: Record<BasePaymentChannel, string> = {
  e_wallet: "E-Wallet",
  paypal: "PayPal",
  wise: "Wise",
  bank: "Bank",
};

// The 4 fixed, still-selectable base channels — shared between every
// client dropdown and the server's dedup-match check in
// lib/paymentChannels.ts, so the two never drift. Lives here (not in
// paymentChannels.ts, which is server-only) since client components need
// it too. Mirrors BASE_EXPENSE_CATEGORIES's role for categories.
export const BASE_PAYMENT_CHANNELS = Object.entries(PAYMENT_CHANNEL_LABELS) as [BasePaymentChannel, string][];

// Sentinel <select> value for "+ Add Channel" — never stored, only used
// client-side to know when to reveal the new-channel text input.
export const ADD_CHANNEL_VALUE = "__add_channel__";

// Shared verbatim across Dashboard, Diver Form (BillSummary/InvoicePanel),
// Settlement, and Reports Overview — one label/hint pair so the same figure
// reads identically everywhere it's shown, instead of four independently
// worded strings drifting apart.
export const EXCESS_LABEL = "Excess (Change)";
export const EXCESS_HINT =
  "Cash or foreign-currency tender above what was billed — not counted as revenue.";

export function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getPaidAmount(
  payment:
    | {
        total_collected: number | null;
        total_paid: number | null;
        cash_amount: number | null;
        card_amount: number | null;
        online_amount: number | null;
        card_surcharge_amount: number | null;
        online_surcharge_amount: number | null;
      }
    | undefined,
): number {
  if (!payment) return 0;
  const positive = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return (
    positive(payment.total_collected) ??
    positive(payment.total_paid) ??
    safeNum(payment.cash_amount) +
      safeNum(payment.card_amount) +
      safeNum(payment.online_amount) +
      safeNum(payment.card_surcharge_amount) +
      safeNum(payment.online_surcharge_amount)
  );
}
