// Email clients strip <style> blocks and ignore Tailwind's compiled
// stylesheet entirely (it's never included in the email itself), so this
// mirrors InvoicePanel.tsx's print layout but with genuinely inline styles
// instead of class names — the two intentionally look similar, not shared,
// since the constraints (email-safe HTML vs. a real browser print view)
// are different enough that trying to share one component isn't worth it.
// The totals themselves come from invoiceSummary.ts, shared with the print view.

import { EXCESS_LABEL } from "@/lib/payments";
import { activityRowTotal, fmtExchangeRate, fmtForeignAmount, summarizeInvoice } from "./invoiceSummary";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })
  );
}

export function buildInvoiceEmailHtml(params: {
  diveCenterName: string;
  snapshot: Record<string, unknown>;
  depositsApplied: number;
}): string {
  const { diveCenterName, snapshot, depositsApplied } = params;
  const activities = (snapshot.activities as Record<string, unknown>[] | undefined) ?? [];
  const summary = summarizeInvoice(snapshot, depositsApplied);
  const diverName = typeof snapshot.diver_name === "string" ? snapshot.diver_name : "Diver";
  const closedAt = typeof snapshot.closed_at === "string" ? snapshot.closed_at : new Date().toISOString();
  const closedBy = typeof snapshot.closed_by === "string" ? snapshot.closed_by : "—";

  const rows = activities
    .map(
      (a) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">${String(a.date ?? "—")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">${String(a.dive_site ?? "—")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${peso(activityRowTotal(a))}</td>
        </tr>`,
    )
    .join("");

  const withSurcharge = (line: { amount: number; surcharge: number }) =>
    line.surcharge > 0 ? `${peso(line.amount)} (surcharge ${peso(line.surcharge)})` : peso(line.amount);
  const { foreignCash, card, online } = summary;

  // [label, value, extra cell style]
  const paymentRows = [
    ["Subtotal", peso(summary.subtotal), ""],
    summary.discount > 0 ? ["Discount", `− ${peso(summary.discount)}`, ""] : null,
    summary.depositsApplied > 0 ? ["Less: Deposit", `− ${peso(summary.depositsApplied)}`, ""] : null,
    summary.discount > 0 || summary.depositsApplied > 0 ? ["Amount Due", peso(summary.amountDue), "font-weight:bold;"] : null,
    summary.cash > 0 ? ["Cash", peso(summary.cash), ""] : null,
    foreignCash
      ? [
          `Cash (${foreignCash.currency})`,
          `${foreignCash.currency} ${fmtForeignAmount(foreignCash.amount)} @ ₱${fmtExchangeRate(foreignCash.rate)} = ${peso(foreignCash.php)}`,
          "",
        ]
      : null,
    card ? ["Card", withSurcharge(card), ""] : null,
    online ? ["Online", withSurcharge(online), ""] : null,
    summary.excess > 0 ? [EXCESS_LABEL, peso(summary.excess), "color:#c2410c;"] : null,
  ]
    .filter((r): r is [string, string, string] => r !== null)
    .map(
      ([label, value, style]) => `
        <tr>
          <td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #eee;${style}">${label}</td>
          <td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #eee;text-align:right;${style}">${value}</td>
        </tr>`,
    )
    .join("");

  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
  <div style="border-bottom:2px solid #1a1a2e;padding-bottom:16px;margin-bottom:20px;">
    <div style="font-size:22px;font-weight:bold;">${diveCenterName}</div>
    <div style="font-size:13px;color:#888;margin-top:4px;">Invoice for ${diverName}</div>
  </div>

  <p style="font-size:14px;">Hi ${diverName},</p>
  <p style="font-size:14px;">Thanks for diving with us! Here's your invoice, closed on ${fmtDateTime(closedAt)} by ${closedBy}.</p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr style="background:#f5f5f5;text-align:left;">
        <th style="padding:8px;font-size:11px;text-transform:uppercase;color:#888;">Date</th>
        <th style="padding:8px;font-size:11px;text-transform:uppercase;color:#888;">Activity</th>
        <th style="padding:8px;font-size:11px;text-transform:uppercase;color:#888;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table style="width:100%;max-width:360px;margin-left:auto;border:1px solid #eee;border-radius:8px;overflow:hidden;border-collapse:collapse;">
    <tbody>
      ${paymentRows}
      <tr style="background:#1a1a2e;color:#fff;font-weight:bold;">
        <td style="padding:8px 10px;font-size:14px;">Grand Total</td>
        <td style="padding:8px 10px;font-size:14px;text-align:right;">${peso(summary.grandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <p style="font-size:12px;color:#999;text-align:center;margin-top:28px;border-top:1px solid #eee;padding-top:12px;">
    ${diveCenterName}
  </p>
</div>`;
}
