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
  discount: number;
};

export type PaymentBreakdown = PaymentInput & {
  cashForeignPHP: number;
  cardSurchargeRate: number;
  cardSurchargeAmount: number;
  onlineSurchargeRate: number;
  onlineSurchargeAmount: number;
  totalSurcharge: number;
  totalCollected: number;
};

export function computePaymentBreakdown(
  input: PaymentInput,
  cardSurchargeRate: number,
  onlineSurchargeRate: number,
): PaymentBreakdown {
  const cashForeignPHP = input.cashAmountForeign * input.cashExchangeRate;
  const cardSurchargeAmount = input.cardAmount * cardSurchargeRate;
  const onlineSurchargeAmount = input.onlineAmount * onlineSurchargeRate;
  const totalSurcharge = cardSurchargeAmount + onlineSurchargeAmount;
  const totalCollected =
    input.cashAmount + cashForeignPHP + input.cardAmount + cardSurchargeAmount + input.onlineAmount + onlineSurchargeAmount;

  return {
    ...input,
    cashForeignPHP,
    cardSurchargeRate,
    cardSurchargeAmount,
    onlineSurchargeRate,
    onlineSurchargeAmount,
    totalSurcharge,
    totalCollected,
  };
}
