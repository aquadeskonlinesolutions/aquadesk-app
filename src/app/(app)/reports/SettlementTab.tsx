"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getSettlementData } from "./actions";
import type { SettlementRow, SettlementData } from "./data";
import { EXCESS_LABEL } from "@/lib/payments";

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtPHP(n: number): string {
  // U+2060 keeps the minus sign from wrapping away from the amount.
  if (n < 0) return `−⁠₱${Math.round(-n).toLocaleString("en-PH")}`;
  return n === 0 ? "—" : `₱${Math.round(n).toLocaleString("en-PH")}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function peso2(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Deposit cancellation notes (migration 047). The received-day deposit row
// keeps its original figures; the cancel-day refund row carries the cash
// outflow. Both say what happened so neither day changes without a trace.
function cancellationNote(r: SettlementRow): string | null {
  const c = r.cancellation;
  if (!c) return null;
  if (r.isDepositRefund) {
    return `Deposit of ${peso2(c.amount)} received ${fmtDate(c.depositDate)} cancelled. Refunded ${peso2(c.refundAmount)}${
      c.refundAmount > 0 && c.refundMethodLabel ? ` (${c.refundMethodLabel})` : ""
    } · Forfeited ${peso2(c.forfeitedAmount)} (retained, no cash movement) · Reason: ${c.reason}`;
  }
  return `Cancelled on ${fmtDate(c.cancelledDate)} · Refunded ${peso2(c.refundAmount)} · Forfeited ${peso2(c.forfeitedAmount)}`;
}

function diverLabel(r: SettlementRow): string {
  if (r.isDepositRefund) return `${r.diverName} (Deposit Refund)`;
  return r.isDeposit ? `${r.diverName} (Deposit)` : r.diverName;
}

function totals(rows: SettlementRow[]) {
  return {
    cashPHP: rows.reduce((s, r) => s + r.cashPHP, 0),
    foreignPHP: rows.reduce((s, r) => s + r.foreignPHP, 0),
    card: rows.reduce((s, r) => s + r.card, 0),
    cardSurcharge: rows.reduce((s, r) => s + r.cardSurcharge, 0),
    online: rows.reduce((s, r) => s + r.online, 0),
    onlineSurcharge: rows.reduce((s, r) => s + r.onlineSurcharge, 0),
    totalCollected: rows.reduce((s, r) => s + r.totalCollected, 0),
    excessAmount: rows.reduce((s, r) => s + r.excessAmount, 0),
  };
}

function downloadCsv(data: SettlementData) {
  const headers = [
    "Date",
    "Diver",
    "Closed By",
    "Cash (PHP)",
    "Foreign",
    "Card",
    "Card Surcharge",
    "Online",
    "Online Channel",
    "Online Surcharge",
    "Total Collected",
    EXCESS_LABEL,
  ];
  const csvRows = data.rows.map((r) =>
    [
      r.date,
      cancellationNote(r) ? `${diverLabel(r)} — ${cancellationNote(r)}` : diverLabel(r),
      r.closedBy,
      r.cashPHP,
      r.isDeposit || r.isDepositRefund ? "" : r.foreign,
      r.card,
      r.isDeposit || r.isDepositRefund ? "" : r.cardSurcharge,
      r.online,
      r.onlineChannelLabel ?? "",
      r.isDeposit || r.isDepositRefund ? "" : r.onlineSurcharge,
      r.isDeposit || r.isDepositRefund ? "" : r.totalCollected,
      r.isDeposit || r.isDepositRefund ? "" : r.excessAmount,
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const tot = totals(data.rows);
  csvRows.push(
    [
      `"${data.date}"`,
      `"GRAND TOTAL"`,
      `""`,
      tot.cashPHP,
      `"${tot.foreignPHP > 0 ? `≈ PHP ${Math.round(tot.foreignPHP)}` : ""}"`,
      tot.card,
      tot.cardSurcharge,
      tot.online,
      `""`,
      tot.onlineSurcharge,
      tot.totalCollected,
      tot.excessAmount,
    ].join(","),
  );
  const csv = [headers.join(","), ...csvRows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `settlement-${data.date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettlementTab({ data }: { data: SettlementData }) {
  const [date, setDate] = useState(data.date || todayManila());
  const [settlement, setSettlement] = useState(data);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    if (!date) {
      setError("Please select a date.");
      return;
    }
    setError(null);
    startTransition(async () => {
      setSettlement(await getSettlementData(date));
    });
  }

  const tot = totals(settlement.rows);
  const hasRows = settlement.rows.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-none gap-5">
      <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-extrabold text-navy">Daily Settlement</div>
            <div className="text-xs text-gray-500 mt-0.5">
              All payments recorded for the selected date. Highlighted rows are deposits.
              {settlement.rows.some((r) => r.isDepositRefund) &&
                " Red rows are refunds of cancelled deposits, subtracted from this day's totals."}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Select Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
            />
            <button
              onClick={load}
              disabled={pending}
              className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
            >
              {pending ? "Loading…" : "Load"}
            </button>
            <button
              onClick={() => window.print()}
              disabled={!hasRows}
              className="px-4 py-2 bg-white border border-gray-300 text-navy text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              🖨 Print
            </button>
            <button
              onClick={() => downloadCsv(settlement)}
              disabled={!hasRows}
              className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-50"
            >
              ⬇ Download CSV
            </button>
          </div>
        </div>
        {error && <div className="px-5 py-3 text-sm text-red">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Date</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Diver</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Closed By</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Cash (PHP)
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Foreign</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Card
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Card Surcharge
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Online
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Online Surcharge
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Total Collected
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  {EXCESS_LABEL}
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-gray-400 text-sm">
                    No payments recorded for this date.
                  </td>
                </tr>
              ) : (
                settlement.rows.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-100 last:border-0 ${r.isDeposit ? "bg-orange-light" : ""} ${r.isDepositRefund ? "bg-red-light" : ""}`}
                  >
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-3 py-3 font-semibold text-navy">
                      {r.diverName}
                      {r.isDeposit && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange text-white align-middle">
                          Deposit
                        </span>
                      )}
                      {r.isDeposit && r.cancellation && (
                        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 align-middle">
                          Cancelled
                        </span>
                      )}
                      {r.isDepositRefund && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red text-white align-middle">
                          Deposit Refund
                        </span>
                      )}
                      {cancellationNote(r) && (
                        <div className="text-sm font-normal text-gray-600 mt-1 max-w-[360px]">{cancellationNote(r)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">{r.closedBy}</td>
                    <td className="px-3 py-3 text-right">{fmtPHP(r.cashPHP)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{r.isDeposit || r.isDepositRefund ? "—" : r.foreign}</td>
                    <td className="px-3 py-3 text-right">{fmtPHP(r.card)}</td>
                    <td className="px-3 py-3 text-right">{r.isDeposit || r.isDepositRefund ? "—" : fmtPHP(r.cardSurcharge)}</td>
                    <td className="px-3 py-3 text-right">
                      {fmtPHP(r.online)}
                      {r.online !== 0 && r.onlineChannelLabel && (
                        <div className="text-xs text-gray-400 font-normal">{r.onlineChannelLabel}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">{r.isDeposit || r.isDepositRefund ? "—" : fmtPHP(r.onlineSurcharge)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-navy">
                      {r.isDeposit || r.isDepositRefund ? "—" : fmtPHP(r.totalCollected)}
                    </td>
                    <td className="px-3 py-3 text-right text-orange">
                      {r.isDeposit || r.isDepositRefund ? "—" : fmtPHP(r.excessAmount)}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/diver-form/${r.diverId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-3.5 py-1.5 bg-navy text-white text-xs font-medium rounded-md hover:bg-navy-dark transition-colors whitespace-nowrap"
                      >
                        Open Form
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {hasRows && (
              <tfoot>
                <tr className="bg-navy text-white font-extrabold">
                  <td className="px-3 py-3" colSpan={3}>
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-right">{fmtPHP(tot.cashPHP)}</td>
                  <td className="px-3 py-3 text-right text-xs">
                    {tot.foreignPHP > 0 ? `≈ ₱${Math.round(tot.foreignPHP).toLocaleString("en-PH")}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">{fmtPHP(tot.card)}</td>
                  <td className="px-3 py-3 text-right">{fmtPHP(tot.cardSurcharge)}</td>
                  <td className="px-3 py-3 text-right">{fmtPHP(tot.online)}</td>
                  <td className="px-3 py-3 text-right">{fmtPHP(tot.onlineSurcharge)}</td>
                  <td className="px-3 py-3 text-right">{fmtPHP(tot.totalCollected)}</td>
                  <td className="px-3 py-3 text-right">{fmtPHP(tot.excessAmount)}</td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {hasRows && (
        <div className="hidden print:block p-6">
          <div className="font-display text-2xl text-navy mb-1">{settlement.diveCenterName} — Daily Settlement</div>
          <div className="text-sm text-gray-600 mb-4">
            Date: {fmtDate(settlement.date)} &nbsp;·&nbsp; Printed: {new Date().toLocaleString()}
          </div>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-2 py-1.5 border-b border-gray-300">Date</th>
                <th className="px-2 py-1.5 border-b border-gray-300">Diver</th>
                <th className="px-2 py-1.5 border-b border-gray-300">Closed By</th>
                <th className="px-2 py-1.5 border-b border-gray-300 text-right">Cash (PHP)</th>
                <th className="px-2 py-1.5 border-b border-gray-300">Foreign</th>
                <th className="px-2 py-1.5 border-b border-gray-300 text-right">Card</th>
                <th className="px-2 py-1.5 border-b border-gray-300 text-right">Card Surch.</th>
                <th className="px-2 py-1.5 border-b border-gray-300 text-right">Online</th>
                <th className="px-2 py-1.5 border-b border-gray-300 text-right">Online Surch.</th>
                <th className="px-2 py-1.5 border-b border-gray-300 text-right">Total</th>
                <th className="px-2 py-1.5 border-b border-gray-300 text-right">{EXCESS_LABEL}</th>
              </tr>
            </thead>
            <tbody>
              {settlement.rows.map((r, i) => (
                <tr key={i} className={r.isDeposit ? "bg-orange-light" : r.isDepositRefund ? "bg-red-light" : ""}>
                  <td className="px-2 py-1.5 border-b border-gray-100">{fmtDate(r.date)}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100">
                    {r.diverName}
                    {r.isDeposit && <strong> (Deposit{r.cancellation ? " — Cancelled" : ""})</strong>}
                    {r.isDepositRefund && <strong> (Deposit Refund)</strong>}
                    {cancellationNote(r) && <div className="text-xs text-gray-700">{cancellationNote(r)}</div>}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100">{r.closedBy}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right">{fmtPHP(r.cashPHP)}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-xs">{r.isDeposit || r.isDepositRefund ? "—" : r.foreign}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right">{fmtPHP(r.card)}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right">
                    {r.isDeposit || r.isDepositRefund ? "—" : fmtPHP(r.cardSurcharge)}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right">
                    {fmtPHP(r.online)}
                    {r.online !== 0 && r.onlineChannelLabel && (
                      <div className="text-xs text-gray-500 font-normal">{r.onlineChannelLabel}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right">
                    {r.isDeposit || r.isDepositRefund ? "—" : fmtPHP(r.onlineSurcharge)}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right font-bold">
                    {r.isDeposit || r.isDepositRefund ? "—" : fmtPHP(r.totalCollected)}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right">
                    {r.isDeposit || r.isDepositRefund ? "—" : fmtPHP(r.excessAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-navy text-white font-extrabold">
                <td className="px-2 py-1.5" colSpan={3}>
                  Grand Total
                </td>
                <td className="px-2 py-1.5 text-right">{fmtPHP(tot.cashPHP)}</td>
                <td className="px-2 py-1.5 text-right text-xs">
                  {tot.foreignPHP > 0 ? `≈ ₱${Math.round(tot.foreignPHP).toLocaleString("en-PH")}` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">{fmtPHP(tot.card)}</td>
                <td className="px-2 py-1.5 text-right">{fmtPHP(tot.cardSurcharge)}</td>
                <td className="px-2 py-1.5 text-right">{fmtPHP(tot.online)}</td>
                <td className="px-2 py-1.5 text-right">{fmtPHP(tot.onlineSurcharge)}</td>
                <td className="px-2 py-1.5 text-right">{fmtPHP(tot.totalCollected)}</td>
                <td className="px-2 py-1.5 text-right">{fmtPHP(tot.excessAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
