// Shared between Dashboard and Reports — both need "how much has actually
// been collected against this bill so far" from a payments row.

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
