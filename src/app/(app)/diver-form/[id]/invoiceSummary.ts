// The invoice's totals block, worked out once from a stored invoice snapshot
// so the print view (InvoicePanel.tsx) and the email (invoiceEmailHtml.ts)
// always show the same lines and figures. Display only — reads what the
// snapshot already holds, never recalculates the payment itself.
//
// Snapshots come in two shapes: the rebuild's (checkoutVisit) and the old
// app's (migrated as-is). Neither stores deposits, so the caller passes the
// visit's active-deposit total (same sum as Bill Summary's "Deposits
// Applied"). A closed bill's deposits can't change without unlocking it, and
// re-closing writes a new invoice, so for a visit's latest invoice that's
// the deposit total it was closed with.
//
// `grand_total` means different things in the two shapes (rebuild: activity
// subtotal; old app: total collected incl. surcharge), so the subtotal is
// taken from the activity rows the invoice itself prints instead.

export type InvoiceSummary = {
  subtotal: number;
  discount: number;
  depositsApplied: number;
  amountDue: number;
  cash: number;
  foreignCash: { currency: string; amount: number; rate: number; php: number } | null;
  card: { amount: number; surcharge: number } | null;
  online: { amount: number; surcharge: number } | null;
  excess: number;
  grandTotal: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function activityRowTotal(a: Record<string, unknown>): number {
  return (
    num(a.dive_rate) +
    num(a.fuel_surcharge) +
    num(a.marine_tax) +
    num(a.shark_fee) +
    num(a.nitrox_fee) +
    num(a.fifteen_l_fee) +
    num(a.equipment_rental) +
    num(a.addons)
  );
}

export function summarizeInvoice(snapshot: Record<string, unknown>, depositsApplied: number): InvoiceSummary {
  const activities = (snapshot.activities as Record<string, unknown>[] | undefined) ?? [];
  const payment = (snapshot.payment as Record<string, unknown> | undefined) ?? {};

  const subtotal = activities.reduce((s, a) => s + activityRowTotal(a), 0);
  const discount = num(snapshot.discount);
  const deposits = Math.max(0, num(depositsApplied));
  const amountDue = Math.max(0, subtotal - discount - deposits);

  const cardAmount = num(payment.card_amount);
  const cardSurcharge = num(payment.card_surcharge_amount);
  const onlineAmount = num(payment.online_amount);
  const onlineSurcharge = num(payment.online_surcharge_amount);

  const foreignAmount = num(payment.cash_amount_foreign);
  const foreignRate = num(payment.cash_exchange_rate);
  const foreignCurrency = typeof payment.cash_currency === "string" ? payment.cash_currency : null;

  return {
    subtotal,
    discount,
    depositsApplied: deposits,
    amountDue,
    cash: num(payment.cash_amount),
    foreignCash:
      foreignAmount > 0 && foreignCurrency
        ? { currency: foreignCurrency, amount: foreignAmount, rate: foreignRate, php: foreignAmount * foreignRate }
        : null,
    card: cardAmount > 0 ? { amount: cardAmount, surcharge: cardSurcharge } : null,
    online: onlineAmount > 0 ? { amount: onlineAmount, surcharge: onlineSurcharge } : null,
    excess: num(payment.excess_amount),
    // What the diver paid at checkout: the amount due after deposits, plus
    // the card/online surcharges charged on top. Excess (Change) is shown
    // on its own line, never added in.
    grandTotal: amountDue + (cardAmount > 0 ? cardSurcharge : 0) + (onlineAmount > 0 ? onlineSurcharge : 0),
  };
}

export function fmtForeignAmount(n: number): string {
  return n.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

export function fmtExchangeRate(n: number): string {
  return n.toLocaleString("en-PH", { maximumFractionDigits: 6 });
}
