"use client";

import { useState, useTransition } from "react";
import { savePaymentOnly, checkoutVisit } from "../actions";
import { computePaymentBreakdown, type PaymentInput } from "../billing";
import type { Activity, Deposit, ExistingPayment, PaymentConfig, Visit } from "../data";
import { useToast } from "@/components/ui/Toast";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

function emptyInput(existing: ExistingPayment | null): PaymentInput {
  return {
    cashAmount: existing?.cashAmount ?? 0,
    cashAmountForeign: existing?.cashAmountForeign ?? 0,
    cashCurrencyCode: existing?.cashCurrencyCode ?? null,
    cashExchangeRate: existing?.cashExchangeRate ?? 0,
    cardAmount: existing?.cardAmount ?? 0,
    onlineAmount: existing?.onlineAmount ?? 0,
    discount: existing?.discount ?? 0,
  };
}

export function BillSummary({
  diverId,
  visit,
  setVisit,
  activities,
  deposits,
  existingPayment,
  paymentConfig,
  onCheckedOut,
}: {
  diverId: string;
  visit: Visit;
  setVisit: (v: Visit | null) => void;
  activities: Activity[];
  deposits: Deposit[];
  existingPayment: ExistingPayment | null;
  paymentConfig: PaymentConfig;
  onCheckedOut: (invoiceId: string) => void;
}) {
  const [input, setInput] = useState<PaymentInput>(emptyInput(existingPayment));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showToast = useToast();

  const grandTotal = activities.filter((a) => a.status !== "cancelled").reduce((s, a) => s + a.total, 0);
  const depositsTotal = deposits.reduce((s, d) => s + d.amount, 0);
  const amountOwed = grandTotal - input.discount - depositsTotal;
  const breakdown = computePaymentBreakdown(input, paymentConfig.cardSurchargeRate, paymentConfig.onlineSurchargeRate, amountOwed);
  const balance = Math.max(0, amountOwed - breakdown.totalCollected);
  const hasOpenActivities = activities.some(
    (a) => a.status === "planned" || a.status === "scheduled" || a.status === "ongoing",
  );
  const canCheckout = balance <= 0 && !hasOpenActivities && activities.length > 0;

  function update(patch: Partial<PaymentInput>) {
    setInput((prev) => ({ ...prev, ...patch }));
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await savePaymentOnly(diverId, visit.id, visit.updatedAt, grandTotal, depositsTotal, input);
      if (res.error) {
        setError(res.error);
        if (res.conflict) {
          showToast("This bill was changed by someone else — reload the page to see their latest version.", "error");
        }
      } else {
        setMessage("Payment saved. Visit stays open until checkout.");
        if (res.updatedAt) setVisit({ ...visit, updatedAt: res.updatedAt });
      }
    });
  }

  function checkout() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await checkoutVisit(diverId, visit.id, visit.updatedAt, input);
      if (res.error) {
        setError(res.error);
        if (res.conflict) {
          showToast("This bill was changed by someone else — reload the page to see their latest version.", "error");
        }
      } else if (res.invoiceId) onCheckedOut(res.invoiceId);
    });
  }

  const num = (value: number, onChange: (v: number) => void, width = "w-24") => (
    <input
      type="number"
      onFocus={(e) => e.currentTarget.select()}
      step="0.01"
      min={0}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={`${width} border border-gray-300 rounded-md px-2 py-1.5 text-sm text-right`}
    />
  );

  return (
    <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="text-sm font-extrabold text-navy">Bill Summary</div>
        <div className="text-xs text-gray-500 mt-0.5">Payments collected against this visit — doesn&apos;t close the bill.</div>
      </div>

      <div className="p-5 grid gap-4">
        {error && <div className="text-sm text-red">{error}</div>}
        {message && <div className="text-sm text-green">{message}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Subtotal</div>
            <div className="text-lg font-bold text-navy">{peso(grandTotal)}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Deposits Applied</div>
            <div className="text-lg font-bold text-navy">{peso(depositsTotal)}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Collected</div>
            <div className="text-lg font-bold text-navy">{peso(breakdown.totalCollected)}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Balance</div>
            <div className={`text-lg font-bold ${balance > 0 ? "text-red" : "text-green"}`}>{peso(balance)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-gray-200 pt-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cash (PHP)</label>
            {num(input.cashAmount, (v) => update({ cashAmount: v }), "w-full")}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Card</label>
            {num(input.cardAmount, (v) => update({ cardAmount: v }), "w-full")}
            {breakdown.cardSurchargeAmount > 0 && (
              <div className="text-xs text-gray-400 mt-0.5">+ {peso(breakdown.cardSurchargeAmount)} surcharge</div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Online</label>
            {num(input.onlineAmount, (v) => update({ onlineAmount: v }), "w-full")}
            {breakdown.onlineSurchargeAmount > 0 && (
              <div className="text-xs text-gray-400 mt-0.5">+ {peso(breakdown.onlineSurchargeAmount)} surcharge</div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Foreign Cash Amount</label>
            {num(input.cashAmountForeign, (v) => update({ cashAmountForeign: v }), "w-full")}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
            <select
              value={input.cashCurrencyCode ?? ""}
              onChange={(e) => {
                const code = e.target.value || null;
                const currency = paymentConfig.currencies.find((c) => c.code === code);
                update({ cashCurrencyCode: code, cashExchangeRate: currency?.rateToPhp ?? 0 });
              }}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {paymentConfig.currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Exchange Rate</label>
            {num(input.cashExchangeRate, (v) => update({ cashExchangeRate: v }), "w-full")}
            {breakdown.cashForeignPHP > 0 && (
              <div className="text-xs text-gray-400 mt-0.5">= {peso(breakdown.cashForeignPHP)}</div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Discount</label>
            {num(input.discount, (v) => update({ discount: v }), "w-full")}
          </div>
        </div>

        {hasOpenActivities && (
          <div className="text-xs text-orange">
            Every activity must be Completed or Cancelled before this visit can be checked out.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={save}
            disabled={pending}
            className="px-4 py-2 bg-white border border-gray-300 text-navy text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save (keep open)"}
          </button>
          <button
            onClick={checkout}
            disabled={pending || !canCheckout}
            title={!canCheckout ? "Balance must be ₱0 and every activity completed/cancelled" : undefined}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
          >
            {pending ? "Working…" : "Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}
