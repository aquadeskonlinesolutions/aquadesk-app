"use client";

import { useState } from "react";
import type { AuditInvoiceRow, BillingAuditData } from "./data";

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

function fmtDateOnly(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// invoice_snapshot's shape comes from a checkout flow that isn't built yet
// in the rebuild (part of the not-yet-built Divers page) — these defensive
// multi-name fallbacks match the live app's own reads against the same
// unsettled shape, not a rebuild-side convention.
function snapField(snap: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (snap[k] !== undefined && snap[k] !== null) return snap[k];
  }
  return undefined;
}
function snapNum(snap: Record<string, unknown>, ...keys: string[]): number {
  const n = Number(snapField(snap, ...keys));
  return Number.isFinite(n) ? n : 0;
}
function snapStr(snap: Record<string, unknown>, ...keys: string[]): string {
  const v = snapField(snap, ...keys);
  return v == null ? "" : String(v);
}

function InvoicePreview({
  invoice,
  diveCenterName,
  onClose,
}: {
  invoice: AuditInvoiceRow;
  diveCenterName: string;
  onClose: () => void;
}) {
  const snap = invoice.snapshot;
  const activities = ((snapField(snap, "activities", "rows") as Record<string, unknown>[] | undefined) ?? []).map(
    (a) => ({
      date: snapStr(a, "date", "dive_date") || "—",
      activity: snapStr(a, "dive_site", "activity", "activity_name") || "—",
      staff: snapStr(a, "staff_name", "staff") || "—",
      diveRate: snapNum(a, "dive_rate"),
      fuel: snapNum(a, "fuel_surcharge", "fuel"),
      marineTax: snapNum(a, "marine_tax"),
      nitrox: snapNum(a, "nitrox_fee", "nitrox"),
      equipment: snapNum(a, "equipment_rental", "equipment"),
      addons: snapNum(a, "addons"),
    }),
  );
  const discount = snapNum(snap, "discount");
  const grandTotal = invoice.totalBilled;
  const cash = snapNum(snap, "cash_amount", "cash");
  const card = snapNum(snap, "card_amount", "card");
  const online = snapNum(snap, "online_amount", "online");
  const cardSurcharge = snapNum(snap, "card_surcharge");
  const onlineSurcharge = snapNum(snap, "online_surcharge");
  const currency = snapStr(snap, "currency") || "PHP";
  const fxRate = snapNum(snap, "exchange_rate", "fx_rate");

  return (
    <div className="grid gap-3">
      <div className="print:hidden flex items-center justify-between bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-3">
        <div className="text-sm text-gray-600">
          Previewing invoice for <strong className="text-navy">{invoice.diverName}</strong>, sent{" "}
          {fmtDateTime(invoice.sentAt)}.
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid"
          >
            🖨 Print / Save as PDF
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            Close
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-navy pb-4 mb-5">
          <div>
            <div className="font-display text-2xl text-navy">{diveCenterName}</div>
            <div className="text-sm text-gray-500 mt-1">Invoice</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Sent</div>
            <div className="text-lg font-bold text-teal">{fmtDateOnly(invoice.sentAt)}</div>
          </div>
        </div>

        <div className="flex gap-8 bg-off-white rounded-lg px-4 py-3 mb-5">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Diver</div>
            <div className="text-sm font-bold text-navy">{invoice.diverName}</div>
          </div>
          {invoice.diverNationality && (
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Nationality</div>
              <div className="text-sm font-bold text-navy">{invoice.diverNationality}</div>
            </div>
          )}
          {currency !== "PHP" && (
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Currency</div>
              <div className="text-sm font-bold text-navy">
                {currency}
                {fxRate ? ` @ ₱${fxRate}` : ""}
              </div>
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
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Marine Tax</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Nitrox</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Equipment</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-right">Addons</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-6 text-gray-400">
                  No activity data in snapshot.
                </td>
              </tr>
            ) : (
              activities.map((a, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-2 py-2">{a.date}</td>
                  <td className="px-2 py-2">{a.activity}</td>
                  <td className="px-2 py-2">{a.staff}</td>
                  <td className="px-2 py-2 text-right">{peso(a.diveRate)}</td>
                  <td className="px-2 py-2 text-right">{peso(a.fuel)}</td>
                  <td className="px-2 py-2 text-right">{peso(a.marineTax)}</td>
                  <td className="px-2 py-2 text-right">{peso(a.nitrox)}</td>
                  <td className="px-2 py-2 text-right">{peso(a.equipment)}</td>
                  <td className="px-2 py-2 text-right">{peso(a.addons)}</td>
                </tr>
              ))
            )}
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
              {cash > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">Cash</td>
                  <td className="px-3 py-2 text-right">{peso(cash)}</td>
                </tr>
              )}
              {card > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">
                    Card{cardSurcharge > 0 ? ` (incl. surcharge ${peso(cardSurcharge)})` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">{peso(card)}</td>
                </tr>
              )}
              {online > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">
                    Online{onlineSurcharge > 0 ? ` (incl. surcharge ${peso(onlineSurcharge)})` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">{peso(online)}</td>
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
          Generated by AquaDesk · Closed by {invoice.closedBy} on {fmtDateOnly(invoice.sentAt)}
        </div>
      </div>
    </div>
  );
}

export function BillingAuditTab({ data }: { data: BillingAuditData }) {
  const [search, setSearch] = useState("");
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<AuditInvoiceRow | null>(null);

  const filteredInvoices = search.trim()
    ? data.invoices.filter((inv) => {
        const q = search.trim().toLowerCase();
        return inv.diverName.toLowerCase().includes(q) || inv.diverEmail.toLowerCase().includes(q);
      })
    : data.invoices;

  if (previewInvoice) {
    return (
      <InvoicePreview
        invoice={previewInvoice}
        diveCenterName={data.diveCenterName}
        onClose={() => setPreviewInvoice(null)}
      />
    );
  }

  return (
    <div className="print:hidden grid gap-5">
      <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
        Billing Audit gives you a complete invoice history and flags any bill that was closed more than once — a
        sign that charges may have changed after payment was collected.
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">🔴 Flagged Bills</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Divers whose bill was closed more than once. Click a flagged row to see all invoices sent.
          </div>
        </div>
        {data.flagged.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No flagged bills. All invoices look clean.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Diver</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                    Invoices Sent
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Flag</th>
                </tr>
              </thead>
              <tbody>
                {data.flagged.map((v) => (
                  <FlaggedVisitRows
                    key={v.visitId}
                    visit={v}
                    expanded={expandedVisit === v.visitId}
                    onToggle={() => setExpandedVisit(expandedVisit === v.visitId ? null : v.visitId)}
                    onViewInvoice={setPreviewInvoice}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-extrabold text-navy">Invoice History</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Every invoice ever sent. Search by diver name or email.
            </div>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm max-w-[240px]"
          />
        </div>
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Diver</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Sent At</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Closed By</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                    Total Billed
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Download</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy">{inv.diverName}</td>
                    <td className="px-4 py-3">{inv.diverEmail}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(inv.sentAt)}</td>
                    <td className="px-4 py-3">{inv.closedBy}</td>
                    <td className="px-4 py-3 text-right">{peso(inv.totalBilled)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setPreviewInvoice(inv)} className="text-xs text-teal hover:text-navy">
                        ⬇ View / Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">Bill Unlock Log</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Every time a closed bill was unlocked with the billing password.
          </div>
        </div>
        {data.unlocks.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No bill unlocks recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Diver / Bill
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Unlocked By
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Unlocked At
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.unlocks.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy">{log.label}</td>
                    <td className="px-4 py-3">{log.unlockedBy}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(log.unlockedAt)}</td>
                    <td className="px-4 py-3 text-gray-500">{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FlaggedVisitRows({
  visit,
  expanded,
  onToggle,
  onViewInvoice,
}: {
  visit: BillingAuditData["flagged"][number];
  expanded: boolean;
  onToggle: () => void;
  onViewInvoice: (inv: AuditInvoiceRow) => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-off-white"
      >
        <td className="px-4 py-3 font-semibold text-navy">{visit.diverName}</td>
        <td className="px-4 py-3">{visit.diverEmail}</td>
        <td className="px-4 py-3 text-right">{visit.invoiceCount}</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-red text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-red inline-block" /> Flagged
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-off-white">
          <td colSpan={4} className="px-4 py-3">
            {visit.invoices.length === 0 ? (
              <span className="text-gray-500 text-sm">No invoice records found for this visit.</span>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-2 py-1.5 text-xs font-semibold uppercase text-gray-400">#</th>
                    <th className="px-2 py-1.5 text-xs font-semibold uppercase text-gray-400">Sent At</th>
                    <th className="px-2 py-1.5 text-xs font-semibold uppercase text-gray-400">Closed By</th>
                    <th className="px-2 py-1.5 text-xs font-semibold uppercase text-gray-400 text-right">
                      Total Billed
                    </th>
                    <th className="px-2 py-1.5 text-xs font-semibold uppercase text-gray-400">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {visit.invoices.map((inv, i) => (
                    <tr key={inv.id} className="border-t border-gray-200">
                      <td className="px-2 py-1.5">{i + 1}</td>
                      <td className="px-2 py-1.5">{fmtDateTime(inv.sentAt)}</td>
                      <td className="px-2 py-1.5">{inv.closedBy}</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-navy">{peso(inv.totalBilled)}</td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewInvoice(inv);
                          }}
                          className="text-xs text-teal hover:text-navy"
                        >
                          ⬇ View / Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
