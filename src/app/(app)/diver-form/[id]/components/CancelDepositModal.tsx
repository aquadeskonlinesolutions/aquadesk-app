"use client";

import { useState, useTransition } from "react";
import { cancelDeposit } from "../actions";
import type { Deposit } from "../data";
import { BASE_PAYMENT_CHANNELS } from "@/lib/payments";
import type { CustomChannelOption } from "@/lib/paymentChannels";

function peso2(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

// Works in whole centavos so 1000.10 − 600.05 never shows float noise.
function toCents(s: string): number | null {
  const t = s.trim();
  if (!AMOUNT_PATTERN.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function CancelDepositModal({
  diverId,
  visitId,
  deposit,
  customChannels,
  onClose,
  onCancelled,
}: {
  diverId: string;
  visitId: string;
  deposit: Deposit;
  customChannels: CustomChannelOption[];
  onClose: () => void;
  onCancelled: (deposits: Deposit[], visitUpdatedAt: string | null) => void;
}) {
  // Deposits are applied to a bill only as a lump sum at checkout, and this
  // panel only shows while the bill is open — so nothing has been applied
  // yet and the whole deposit is refundable. The server re-checks this.
  const maxCents = Math.round(deposit.amount * 100);
  const maxStr = (maxCents / 100).toFixed(2);

  // Starts empty on purpose: staff must actively choose an amount (or use
  // Full refund / No refund) rather than confirm a pre-filled one.
  const [refund, setRefund] = useState("");
  const [method, setMethod] = useState<"" | "cash" | "card" | "online">(deposit.method);
  // A base channel key, "" (none chosen) or `custom:<id>`.
  const [channelSelection, setChannelSelection] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refundCents = toCents(refund);
  const refundValid = refundCents !== null && refundCents <= maxCents;
  const forfeitCents = refundValid ? maxCents - refundCents : null;
  const isRefund = refundValid && refundCents > 0;

  function validate(): string | null {
    if (!refund.trim()) return "Enter a refund amount, or use Full refund / No refund.";
    if (refundCents === null) return "Refund amount must be 0 or more, with at most 2 decimal places.";
    if (refundCents > maxCents) return `Refund can't be more than the refundable amount (${peso2(deposit.amount)}).`;
    if (isRefund && !method) return "Select how the refund is paid out.";
    if (isRefund && method === "online" && !channelSelection) return "Select an Online channel for the refund.";
    if (!reason.trim()) return "A cancellation reason is required.";
    if (!password) return "Enter the billing password.";
    return null;
  }

  function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const isCustom = channelSelection.startsWith("custom:");
    startTransition(async () => {
      const res = await cancelDeposit(diverId, visitId, deposit.id, {
        refundAmount: refund.trim(),
        reason,
        password,
        refundMethod: isRefund && method ? method : null,
        refundChannel: isRefund && method === "online" ? (isCustom ? "custom" : channelSelection) : null,
        refundCustomChannelId: isRefund && method === "online" && isCustom ? channelSelection.slice(7) : null,
      });
      if (res.error || !res.deposits) {
        setError(res.error ?? "Could not cancel this deposit.");
        setPassword("");
      } else {
        onCancelled(res.deposits, res.visitUpdatedAt ?? null);
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-xl text-navy">Cancel Deposit</div>
          <button onClick={onClose} disabled={pending} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-6 grid gap-4">
          <p className="text-sm text-gray-600">
            Deposit of <strong className="text-navy">{peso2(deposit.amount)}</strong> received{" "}
            {fmtDate(deposit.depositDate)} ({deposit.method}
            {deposit.method === "online" && deposit.channelLabel ? ` · ${deposit.channelLabel}` : ""}). Enter how much is
            returned to the diver under your cancellation policy — the rest is kept by the dive center. This is logged
            for audit purposes and can&apos;t be undone.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Refund amount</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={maxStr}
                step="0.01"
                value={refund}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setRefund(e.target.value)}
                className="w-36 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setRefund(maxStr)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-navy hover:bg-gray-50"
              >
                Full refund
              </button>
              <button
                type="button"
                onClick={() => setRefund("0")}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-navy hover:bg-gray-50"
              >
                No refund
              </button>
            </div>
            <div className="text-sm text-gray-600 mt-1">Refundable: {peso2(deposit.amount)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
              <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Refund to diver</div>
              <div className="text-lg font-bold text-navy">{refundValid ? peso2(refundCents / 100) : "—"}</div>
            </div>
            <div className="rounded-xl bg-orange-light border border-gray-200 px-3 py-2">
              <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Forfeited (kept)</div>
              <div className="text-lg font-bold text-navy">{forfeitCents !== null ? peso2(forfeitCents / 100) : "—"}</div>
            </div>
          </div>

          {isRefund && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Refund paid out by</label>
              <div className="flex flex-wrap gap-1.5">
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value as "" | "cash" | "card" | "online");
                    setChannelSelection("");
                  }}
                  className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                >
                  <option value="">Method</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="online">Online</option>
                </select>
                {method === "online" && (
                  <select
                    value={channelSelection}
                    onChange={(e) => setChannelSelection(e.target.value)}
                    className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    <option value="">Channel</option>
                    {BASE_PAYMENT_CHANNELS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                    {customChannels.map((c) => (
                      <option key={c.id} value={`custom:${c.id}`}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="e.g. Diver cancelled the trip"
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Billing password"
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>

          {error && <div className="text-sm text-red">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
          <button onClick={onClose} disabled={pending} className="px-4 py-2 text-sm text-gray-600">
            Keep Deposit
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 bg-red text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Cancelling…" : "Cancel Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}
