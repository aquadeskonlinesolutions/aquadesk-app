"use client";

import { useState, useTransition } from "react";
import { sendInvoice } from "../actions";
import type { VisitInvoice } from "../data";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

function fmtDateTime(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
  );
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function InvoicePanel({
  diverId,
  diveCenterName,
  invoice,
  onSent,
  onUnlockClick,
  isPrintTarget,
  onPrintClick,
}: {
  diverId: string;
  diveCenterName: string;
  invoice: VisitInvoice;
  onSent: () => void;
  onUnlockClick: () => void;
  isPrintTarget: boolean;
  onPrintClick: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const snap = invoice.snapshot;
  const activities = (snap.activities as Record<string, unknown>[] | undefined) ?? [];
  const payment = (snap.payment as Record<string, unknown> | undefined) ?? {};
  const grandTotal = num(snap.grand_total);
  const discount = num(snap.discount);
  const diverName = typeof snap.diver_name === "string" ? snap.diver_name : "Diver";
  const nationality = typeof snap.nationality === "string" ? snap.nationality : null;
  const closedAt = typeof snap.closed_at === "string" ? snap.closed_at : invoice.sentAt;

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await sendInvoice(diverId, invoice.id);
      if (res.error) setError(res.error);
      else onSent();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="print:hidden flex items-center justify-between bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-3 flex-wrap gap-2">
        <div className="text-sm text-gray-600">
          Visit closed and invoiced {fmtDateTime(invoice.sentAt)}
          {invoice.emailDeliveryStatus === "sent" && (
            <span className="text-green"> · Emailed {fmtDateTime(invoice.emailSentAt)}</span>
          )}
        </div>
        {error && <div className="text-sm text-red">{error}</div>}
        <div className="flex gap-2">
          <button
            onClick={onPrintClick}
            className="px-4 py-2 bg-white border border-gray-300 text-navy text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            🖨 Print / Save as PDF
          </button>
          <button
            onClick={send}
            disabled={pending || invoice.emailDeliveryStatus === "sent"}
            className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
          >
            {invoice.emailDeliveryStatus === "sent" ? "Sent" : pending ? "Sending…" : "Send Invoice"}
          </button>
          <button
            onClick={onUnlockClick}
            className="px-4 py-2 bg-white border border-gray-300 text-red text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Unlock Bill
          </button>
        </div>
      </div>

      <div className={`hidden bg-white p-6 ${isPrintTarget ? "print:block" : ""}`}>
        <div className="flex items-start justify-between border-b-2 border-navy pb-4 mb-5">
          <div>
            <div className="font-display text-2xl text-navy">{diveCenterName}</div>
            <div className="text-sm text-gray-500 mt-1">Invoice</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Closed</div>
            <div className="text-lg font-bold text-teal">{fmtDateTime(closedAt)}</div>
          </div>
        </div>

        <div className="flex gap-8 bg-off-white rounded-lg px-4 py-3 mb-5">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Diver</div>
            <div className="text-sm font-bold text-navy">{diverName}</div>
          </div>
          {nationality && (
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Nationality</div>
              <div className="text-sm font-bold text-navy">{nationality}</div>
            </div>
          )}
        </div>

        <table className="w-full text-sm mb-5">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Date</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Activity</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Staff</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Dive Rate</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Fuel</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Marine</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Shark</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Nitrox</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">15L</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Equip.</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Addons</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2 py-2">{String(a.date ?? "—")}</td>
                <td className="px-2 py-2">{String(a.dive_site ?? "—")}</td>
                <td className="px-2 py-2">{String(a.staff_name ?? "—")}</td>
                <td className="px-2 py-2 text-right">{peso(num(a.dive_rate))}</td>
                <td className="px-2 py-2 text-right">{peso(num(a.fuel_surcharge))}</td>
                <td className="px-2 py-2 text-right">{peso(num(a.marine_tax))}</td>
                <td className="px-2 py-2 text-right">{peso(num(a.shark_fee))}</td>
                <td className="px-2 py-2 text-right">{peso(num(a.nitrox_fee))}</td>
                <td className="px-2 py-2 text-right">{peso(num(a.fifteen_l_fee))}</td>
                <td className="px-2 py-2 text-right">{peso(num(a.equipment_rental))}</td>
                <td className="px-2 py-2 text-right">{peso(num(a.addons))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <table className="min-w-[280px] border border-gray-200 rounded-lg overflow-hidden text-sm">
            <tbody>
              {discount > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">Discount</td>
                  <td className="px-3 py-2 text-right text-red">− {peso(discount)}</td>
                </tr>
              )}
              {num(payment.cash_amount) > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">Cash</td>
                  <td className="px-3 py-2 text-right">{peso(num(payment.cash_amount))}</td>
                </tr>
              )}
              {num(payment.card_amount) > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">
                    Card{num(payment.card_surcharge_amount) > 0 ? ` (incl. surcharge ${peso(num(payment.card_surcharge_amount))})` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">{peso(num(payment.card_amount))}</td>
                </tr>
              )}
              {num(payment.online_amount) > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">
                    Online{num(payment.online_surcharge_amount) > 0 ? ` (incl. surcharge ${peso(num(payment.online_surcharge_amount))})` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">{peso(num(payment.online_amount))}</td>
                </tr>
              )}
              <tr className="bg-navy text-white font-bold">
                <td className="px-3 py-2">Grand Total</td>
                <td className="px-3 py-2 text-right">{peso(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-xs text-gray-400 text-center border-t border-gray-200 mt-6 pt-3">
          Closed by {invoice.closedBy ?? "—"} on {fmtDateTime(closedAt)}
        </div>
      </div>
    </div>
  );
}
