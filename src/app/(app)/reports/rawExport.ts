"use server";

// Reports > Export Raw Data — bundles 6 itemized CSVs (Divers per-payment,
// Expenses, Govt Fees, Rental Gears, Join Ride, Staff Activity Summary)
// into one ZIP, all scoped to the Reports page's currently-applied date
// range. Every source query here already exists (loadExpensesData,
// loadGovtFeesData, etc., in ./data) — this file only shapes their output
// into CSV text and zips it, it doesn't duplicate any query logic.
//
// fflate (not a Node zip library like archiver/adm-zip) because this app
// deploys to Cloudflare Workers via OpenNext — fflate is pure JS with no
// dependency on Node's fs/stream APIs, so it works in that runtime.
// zipSync's output is a Uint8Array; base64-encoding it here and decoding
// back into a Blob client-side is simpler and safer across the Server
// Action boundary than trying to hand back raw binary.

import { Buffer } from "node:buffer";
import { zipSync, strToU8 } from "fflate";
import { requireRevenueAccess } from "@/lib/dal";
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "./constants";
import {
  loadDiverPaymentsExport,
  loadExpensesData,
  loadGovtFeesData,
  loadRentalGearsData,
  loadJoinRideData,
  loadStaffActivityData,
} from "./data";

function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}

function expenseCategoryLabel(category: string, customCategory: string | null, customCategoryLabel: string | null): string {
  if (category === "custom") return customCategoryLabel ?? "Custom";
  if (category === "other") {
    const custom = customCategory?.trim();
    return custom ? `Other – ${custom}` : "Other (unspecified)";
  }
  return EXPENSE_CATEGORY_LABELS[category] ?? "Uncategorized";
}

// Folds the channel into the same cell as the method (e.g. "Online
// (PayPal)") rather than adding a new column — Expenses' on-screen table
// already shows the channel this way (as a sub-line under Payment
// Method), so the CSV mirrors that same single-column shape. Takes the
// already-resolved channelLabel (works for both the 4 fixed channels and
// any custom one) rather than re-deriving it from the raw channel enum —
// that raw value alone can't distinguish one custom channel from another.
function expensePaymentMethodCell(paymentMethod: string | null, channelLabel: string | null): string {
  if (!paymentMethod) return "";
  const label = PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod;
  if (paymentMethod === "online" && channelLabel) {
    return `${label} (${channelLabel})`;
  }
  return label;
}

export async function exportRawData(
  dateFrom: string,
  dateTo: string,
): Promise<{ error?: string; base64?: string; filename?: string }> {
  if (!dateFrom || !dateTo) return { error: "Select a date range first." };
  if (dateFrom > dateTo) return { error: "From date must be before or equal to To date." };

  const user = await requireRevenueAccess();

  const [diverPayments, expenses, govtFees, rentalGears, joinRide, staffActivity] = await Promise.all([
    loadDiverPaymentsExport(user.diveCenterId, dateFrom, dateTo),
    loadExpensesData(user.diveCenterId, dateFrom, dateTo),
    loadGovtFeesData(user.diveCenterId, dateFrom, dateTo),
    loadRentalGearsData(user.diveCenterId),
    loadJoinRideData(user.diveCenterId),
    loadStaffActivityData(user.diveCenterId, dateFrom, dateTo),
  ]);

  // Rental Gears / Join Ride are loaded all-time (matching how their own
  // Reports tabs work — see loadRentalGearsData/loadJoinRideData's own
  // comments) and filtered to the applied range here, client-side-style,
  // same as RentalGearsTab/JoinRideTab already do for their own tables.
  const rentalRows = rentalGears.records.filter((r) => r.date >= dateFrom && r.date <= dateTo);
  const joinRows = joinRide.records.filter((r) => r.date >= dateFrom && r.date <= dateTo);

  const diversCsv = toCsv(
    ["Date", "Trace Number", "Name of Diver", "Amount", "Payment Method", "Payment Channel", "Notes"],
    diverPayments.map((r) => [r.date, r.traceNumber, r.diverName, r.amount, r.paymentMethod, r.paymentChannel, r.notes]),
  );

  const expensesCsv = toCsv(
    ["Date", "Category", "Amount", "Payment Method", "Recorded By", "Notes"],
    expenses.records.map((r) => [
      r.date,
      expenseCategoryLabel(r.category, r.customCategory, r.customCategoryLabel),
      r.amount,
      expensePaymentMethodCell(r.paymentMethod, r.channelLabel),
      r.recordedBy,
      r.notes ?? "",
    ]),
  );

  const govtFeesCsv = toCsv(
    ["Date", "Fee Type", "Rate", "Divers", "Total"],
    govtFees.records.map((r) => [r.date, r.feeType, r.rate, r.divers, r.total]),
  );

  const rentalGearsCsv = toCsv(
    ["Date", "Equipment", "Company", "Quantity", "Rate", "Total Amount", "Status", "Balance", "Remarks"],
    rentalRows.map((r) => [
      r.date,
      r.equipment,
      r.company ?? "",
      r.quantity,
      r.rate,
      r.totalAmount,
      r.status,
      r.balance,
      r.remarks ?? "",
    ]),
  );

  const joinRideCsv = toCsv(
    [
      "Date",
      "Direction",
      "Company",
      "Number of Divers",
      "Number of Dives",
      "Dive Sites",
      "Total Amount",
      "Status",
      "Balance",
      "Remarks",
    ],
    joinRows.map((r) => [
      r.date,
      r.direction === "joined_our_boat" ? "Joined Our Boat" : "We Joined Another Boat",
      r.company,
      r.numberOfDivers,
      r.numberOfDives,
      r.diveSites ?? "",
      r.totalAmount,
      r.status,
      r.balance,
      r.remarks ?? "",
    ]),
  );

  // Leading Our Dives and Our Dive Educators are two separate on-screen
  // tables with different columns — combined here into one CSV via a
  // Section column and a unioned column set, rather than shipping a 7th
  // file, since the request named exactly 6 sheets.
  const staffActivityCsv = toCsv(
    [
      "Section",
      "Date",
      "Staff Name",
      "Diver Name",
      "Activity / Course",
      "Number of Divers",
      "Number of Dives",
      "Rate Paid by Diver",
      "Commission",
      "Additional Rate",
      "Total",
      "Status",
    ],
    [
      ...staffActivity.leaderRows.map((r) => [
        "Leading Our Dives",
        r.date,
        r.staffName,
        "",
        r.site,
        r.divers,
        r.dives,
        "",
        r.commissionAmount,
        r.additionalRate,
        r.total,
        r.status,
      ]),
      ...staffActivity.educatorRows.map((r) => [
        "Our Dive Educators",
        r.date,
        r.staffName,
        r.diverName,
        r.course,
        "",
        "",
        r.ratePaidByDiver,
        r.commissionAmount,
        r.additionalRate,
        r.total,
        r.status,
      ]),
    ] as (string | number)[][],
  );

  const zipped = zipSync(
    {
      "Divers.csv": strToU8(diversCsv),
      "Expenses.csv": strToU8(expensesCsv),
      "Govt Expense.csv": strToU8(govtFeesCsv),
      "Rental Gears.csv": strToU8(rentalGearsCsv),
      "Join Ride.csv": strToU8(joinRideCsv),
      "Staff Activity Summary.csv": strToU8(staffActivityCsv),
    },
    { level: 6 },
  );

  return {
    base64: Buffer.from(zipped).toString("base64"),
    filename: `aquadesk-raw-export-${dateFrom}_to_${dateTo}.zip`,
  };
}
