"use client";

import { useState, useTransition } from "react";
import { saveDiveLeaderCommission, saveInstructorCommission } from "./actions";
import type { EducatorCommissionRow, LeaderCommissionRow, StaffActivityData } from "./data";
import { useSettlePayment } from "@/components/ui/SettlePaymentDialog";
import type { CustomChannelOption } from "@/lib/paymentChannels";
import { PAYMENT_CHANNEL_LABELS, type PaymentChannel } from "@/lib/payments";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

// Best-effort label for the optimistic local row patch right after a
// settle action — a brand-new custom channel isn't in `customChannels`
// yet (that list was loaded at page-load time), so this falls back to
// the raw typed text in that one case rather than round-tripping to
// refetch just to get the exact stored casing.
function resolveDisplayChannelLabel(
  channel: PaymentChannel | null | undefined,
  customChannelId: string | null | undefined,
  newChannelLabel: string | null | undefined,
  customChannels: CustomChannelOption[],
): string | null {
  if (!channel) return null;
  if (channel === "custom") {
    return (customChannelId && customChannels.find((c) => c.id === customChannelId)?.label) || newChannelLabel || "Custom";
  }
  return PAYMENT_CHANNEL_LABELS[channel];
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// "Owed"/"Paid" in the UI, "unpaid"/"paid" in the database — same
// commission_status enum used since this table's first version, just
// relabeled per the request's own wording.
function StatusPill({ status }: { status: "unpaid" | "paid" }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        status === "paid" ? "bg-green-light text-green" : "bg-orange-light text-orange"
      }`}
    >
      {status === "paid" ? "Paid" : "Owed"}
    </span>
  );
}

// Round 7 Fix 3: this row is only a live computation from schedule/activity
// data — it has no matching staff_commission_records row yet, so it will
// silently reset/disappear on reload unless Save or Mark as Paid is clicked.
function UnsavedBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 ml-1.5">
      Unsaved
    </span>
  );
}

type EditableLeaderRow = LeaderCommissionRow & { justSaved: boolean };
type EditableEducatorRow = EducatorCommissionRow & { justSaved: boolean };

function withEditable<T>(rows: T[]): (T & { justSaved: boolean })[] {
  return rows.map((r) => ({ ...r, justSaved: false }));
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">
      {children}
    </th>
  );
}

function BulkMarkPaidButton({ owedCount, onClick, pending }: { owedCount: number; onClick: () => void; pending: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending || owedCount === 0}
      className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-40"
    >
      {pending ? "Marking…" : `Mark All Owed as Paid (${owedCount})`}
    </button>
  );
}

// A staff dropdown drives a single-staff view for both tables below (the
// request's own table columns have no "Staff" column — the dropdown is
// the selector, not a filter layered on an all-staff table) — populated
// only from staff who actually have rows in the selected date range.
function StaffPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (options.length === 0) {
    return <div className="text-sm text-gray-400 px-5 py-3">No staff activity in this date range yet.</div>;
  }
  return (
    <div className="px-5 py-3 border-b border-gray-200">
      <label className="block text-xs font-medium text-gray-600 mb-1">Staff</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-xs border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function LeaderTable({
  allRows,
  setRows,
  refreshOverview,
  customChannels,
}: {
  allRows: EditableLeaderRow[];
  setRows: (updater: (prev: EditableLeaderRow[]) => EditableLeaderRow[]) => void;
  refreshOverview?: () => void;
  customChannels: CustomChannelOption[];
}) {
  const settlePayment = useSettlePayment();
  const staffOptions = [...new Set(allRows.map((r) => r.staffName))].sort((a, b) => a.localeCompare(b));
  const [selectedStaff, setSelectedStaff] = useState(staffOptions[0] ?? "");
  const rows = allRows.filter((r) => r.staffName === selectedStaff);

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [pending, startTransition] = useTransition();

  function setCommission(key: string, commissionAmount: number) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, commissionAmount, total: commissionAmount + r.additionalRate, justSaved: false } : r)),
    );
  }
  function setAdditionalRate(key: string, additionalRate: number) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, additionalRate, total: r.commissionAmount + additionalRate, justSaved: false } : r)),
    );
  }

  function persist(
    row: EditableLeaderRow,
    markPaid: boolean,
    paymentMethod?: "cash" | "card" | "online" | null,
    channel?: string | null,
    customChannelId?: string | null,
    newChannelLabel?: string | null,
  ) {
    setPendingKey(row.key);
    setErrorKey(null);
    startTransition(async () => {
      const res = await saveDiveLeaderCommission(
        row.date,
        row.staffName,
        row.site,
        row.dives,
        row.divers,
        row.commissionAmount,
        row.additionalRate,
        markPaid,
        paymentMethod,
        channel,
        customChannelId,
        newChannelLabel,
      );
      if (res.error) {
        setErrorKey(row.key);
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.key === row.key
              ? {
                  ...r,
                  status: res.status!,
                  commissionAmount: res.commissionAmount!,
                  additionalRate: res.additionalRate!,
                  total: res.total!,
                  paymentMethod: res.paymentMethod ?? r.paymentMethod,
                  channel: res.channel ?? r.channel,
                  customChannelId: res.customChannelId ?? r.customChannelId,
                  channelLabel: res.channel
                    ? resolveDisplayChannelLabel(res.channel, res.customChannelId, newChannelLabel, customChannels)
                    : r.channelLabel,
                  justSaved: true,
                  isSaved: true,
                }
              : r,
          ),
        );
        refreshOverview?.();
      }
      setPendingKey(null);
    });
  }

  async function markPaid(row: EditableLeaderRow) {
    const result = await settlePayment(
      "Once marked as Paid, this record can still be edited but can no longer be deleted.",
      { title: "Mark as Paid?", confirmLabel: "Mark Paid", customChannels },
    );
    if (!result) return;
    persist(row, true, result.method, result.channel, result.customChannelId, result.newChannelLabel);
  }

  async function markAllOwed() {
    const owed = rows.filter((r) => r.status === "unpaid");
    if (owed.length === 0) return;
    const result = await settlePayment(
      `Mark all ${owed.length} owed row${owed.length !== 1 ? "s" : ""} for ${selectedStaff} as Paid? Once marked as Paid, a record can still be edited but can no longer be deleted.`,
      { title: "Mark all as Paid?", confirmLabel: "Mark All Paid", customChannels },
    );
    if (!result) return;
    setBulkPending(true);
    await Promise.all(
      owed.map(async (row) => {
        const res = await saveDiveLeaderCommission(
          row.date,
          row.staffName,
          row.site,
          row.dives,
          row.divers,
          row.commissionAmount,
          row.additionalRate,
          true,
          result.method,
          result.channel,
          result.customChannelId,
          result.newChannelLabel,
        );
        if (!res.error) {
          setRows((prev) =>
            prev.map((r) =>
              r.key === row.key
                ? {
                    ...r,
                    status: res.status!,
                    commissionAmount: res.commissionAmount!,
                    additionalRate: res.additionalRate!,
                    total: res.total!,
                    paymentMethod: res.paymentMethod ?? r.paymentMethod,
                    channel: res.channel ?? r.channel,
                    customChannelId: res.customChannelId ?? r.customChannelId,
                    channelLabel: res.channel
                      ? resolveDisplayChannelLabel(res.channel, res.customChannelId, result.newChannelLabel, customChannels)
                      : r.channelLabel,
                    justSaved: false,
                    isSaved: true,
                  }
                : r,
            ),
          );
        }
      }),
    );
    refreshOverview?.();
    setBulkPending(false);
  }

  const totals = rows.reduce(
    (acc, r) => ({
      dives: acc.dives + r.dives,
      commission: acc.commission + r.commissionAmount,
      additionalRate: acc.additionalRate + r.additionalRate,
      total: acc.total + r.total,
    }),
    { dives: 0, commission: 0, additionalRate: 0, total: 0 },
  );

  return (
    <div>
      <StaffPicker options={staffOptions} value={selectedStaff} onChange={setSelectedStaff} />
      {staffOptions.length > 0 && (
        <>
          <div className="px-5 py-3 flex justify-end">
            <BulkMarkPaidButton
              owedCount={rows.filter((r) => r.status === "unpaid").length}
              onClick={markAllOwed}
              pending={bulkPending}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <TableHead>Date</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Number of Divers</TableHead>
                  <TableHead>Number of Dives</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Additional Rate</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-400 text-sm">
                      No fun diving assignments for {selectedStaff} in this date range.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3">{r.site}</td>
                      <td className="px-4 py-3 text-right">{r.divers}</td>
                      <td className="px-4 py-3 text-right">{r.dives}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          onFocus={(e) => e.currentTarget.select()}
                          min={0}
                          value={r.commissionAmount}
                          onChange={(e) => setCommission(r.key, parseFloat(e.target.value) || 0)}
                          className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          onFocus={(e) => e.currentTarget.select()}
                          min={0}
                          value={r.additionalRate}
                          onChange={(e) => setAdditionalRate(r.key, parseFloat(e.target.value) || 0)}
                          className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-navy">{peso(r.total)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                        {r.status === "paid" && r.paymentMethod && (
                          <div className="text-xs text-gray-500 mt-1">
                            via {r.paymentMethod === "online" ? "Online" : r.paymentMethod === "card" ? "Card" : "Cash"}
                            {r.paymentMethod === "online" && r.channelLabel ? ` · ${r.channelLabel}` : ""}
                          </div>
                        )}
                        {!r.isSaved && <UnsavedBadge />}
                        {r.justSaved && <div className="text-xs text-green mt-1">Saved.</div>}
                        {errorKey === r.key && <div className="text-xs text-red mt-1">Could not save.</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => persist(r, false)}
                            disabled={pending && pendingKey === r.key}
                            className="px-2.5 py-1 text-xs font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
                          >
                            Save
                          </button>
                          {r.status !== "paid" && (
                            <button
                              onClick={() => markPaid(r)}
                              disabled={pending && pendingKey === r.key}
                              className="px-2.5 py-1 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-60"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-navy">
                    <td className="px-4 py-3" colSpan={3}>
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right">{totals.dives}</td>
                    <td className="px-4 py-3 text-right">{peso(totals.commission)}</td>
                    <td className="px-4 py-3 text-right">{peso(totals.additionalRate)}</td>
                    <td className="px-4 py-3 text-right">{peso(totals.total)}</td>
                    <td className="px-4 py-3" colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EducatorTable({
  allRows,
  setRows,
  refreshOverview,
  customChannels,
}: {
  allRows: EditableEducatorRow[];
  setRows: (updater: (prev: EditableEducatorRow[]) => EditableEducatorRow[]) => void;
  refreshOverview?: () => void;
  customChannels: CustomChannelOption[];
}) {
  const settlePayment = useSettlePayment();
  const staffOptions = [...new Set(allRows.map((r) => r.staffName))].sort((a, b) => a.localeCompare(b));
  const [selectedStaff, setSelectedStaff] = useState(staffOptions[0] ?? "");
  const rows = allRows.filter((r) => r.staffName === selectedStaff);

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [pending, startTransition] = useTransition();

  function setCommission(key: string, commissionAmount: number) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, commissionAmount, total: commissionAmount + r.additionalRate, justSaved: false } : r)),
    );
  }
  function setAdditionalRate(key: string, additionalRate: number) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, additionalRate, total: r.commissionAmount + additionalRate, justSaved: false } : r)),
    );
  }

  function persist(
    row: EditableEducatorRow,
    markPaid: boolean,
    paymentMethod?: "cash" | "card" | "online" | null,
    channel?: string | null,
    customChannelId?: string | null,
    newChannelLabel?: string | null,
  ) {
    setPendingKey(row.key);
    setErrorKey(null);
    startTransition(async () => {
      const res = await saveInstructorCommission(
        row.date,
        row.staffName,
        row.diverId,
        row.course,
        row.commissionAmount,
        row.additionalRate,
        markPaid,
        paymentMethod,
        channel,
        customChannelId,
        newChannelLabel,
      );
      if (res.error) {
        setErrorKey(row.key);
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.key === row.key
              ? {
                  ...r,
                  status: res.status!,
                  commissionAmount: res.commissionAmount!,
                  additionalRate: res.additionalRate!,
                  total: res.total!,
                  paymentMethod: res.paymentMethod ?? r.paymentMethod,
                  channel: res.channel ?? r.channel,
                  customChannelId: res.customChannelId ?? r.customChannelId,
                  channelLabel: res.channel
                    ? resolveDisplayChannelLabel(res.channel, res.customChannelId, newChannelLabel, customChannels)
                    : r.channelLabel,
                  justSaved: true,
                  isSaved: true,
                }
              : r,
          ),
        );
        refreshOverview?.();
      }
      setPendingKey(null);
    });
  }

  async function markPaid(row: EditableEducatorRow) {
    const result = await settlePayment(
      "Once marked as Paid, this record can still be edited but can no longer be deleted.",
      { title: "Mark as Paid?", confirmLabel: "Mark Paid", customChannels },
    );
    if (!result) return;
    persist(row, true, result.method, result.channel, result.customChannelId, result.newChannelLabel);
  }

  async function markAllOwed() {
    const owed = rows.filter((r) => r.status === "unpaid");
    if (owed.length === 0) return;
    const result = await settlePayment(
      `Mark all ${owed.length} owed row${owed.length !== 1 ? "s" : ""} for ${selectedStaff} as Paid? Once marked as Paid, a record can still be edited but can no longer be deleted.`,
      { title: "Mark all as Paid?", confirmLabel: "Mark All Paid", customChannels },
    );
    if (!result) return;
    setBulkPending(true);
    await Promise.all(
      owed.map(async (row) => {
        const res = await saveInstructorCommission(
          row.date,
          row.staffName,
          row.diverId,
          row.course,
          row.commissionAmount,
          row.additionalRate,
          true,
          result.method,
          result.channel,
          result.customChannelId,
          result.newChannelLabel,
        );
        if (!res.error) {
          setRows((prev) =>
            prev.map((r) =>
              r.key === row.key
                ? {
                    ...r,
                    status: res.status!,
                    commissionAmount: res.commissionAmount!,
                    additionalRate: res.additionalRate!,
                    total: res.total!,
                    paymentMethod: res.paymentMethod ?? r.paymentMethod,
                    channel: res.channel ?? r.channel,
                    customChannelId: res.customChannelId ?? r.customChannelId,
                    channelLabel: res.channel
                      ? resolveDisplayChannelLabel(res.channel, res.customChannelId, result.newChannelLabel, customChannels)
                      : r.channelLabel,
                    justSaved: false,
                    isSaved: true,
                  }
                : r,
            ),
          );
        }
      }),
    );
    refreshOverview?.();
    setBulkPending(false);
  }

  const totals = rows.reduce(
    (acc, r) => ({
      commission: acc.commission + r.commissionAmount,
      additionalRate: acc.additionalRate + r.additionalRate,
      total: acc.total + r.total,
    }),
    { commission: 0, additionalRate: 0, total: 0 },
  );

  return (
    <div>
      <StaffPicker options={staffOptions} value={selectedStaff} onChange={setSelectedStaff} />
      {staffOptions.length > 0 && (
        <>
          <div className="px-5 py-3 flex justify-end">
            <BulkMarkPaidButton
              owedCount={rows.filter((r) => r.status === "unpaid").length}
              onClick={markAllOwed}
              pending={bulkPending}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <TableHead>Date</TableHead>
                  <TableHead>Diver Name</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Rate Paid by Diver</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Additional Rate</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-400 text-sm">
                      No courses for {selectedStaff} in this date range.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 font-semibold text-navy whitespace-nowrap">{r.diverName}</td>
                      <td className="px-4 py-3">{r.course}</td>
                      <td className="px-4 py-3 text-right">{peso(r.ratePaidByDiver)}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          onFocus={(e) => e.currentTarget.select()}
                          min={0}
                          value={r.commissionAmount}
                          onChange={(e) => setCommission(r.key, parseFloat(e.target.value) || 0)}
                          className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          onFocus={(e) => e.currentTarget.select()}
                          min={0}
                          value={r.additionalRate}
                          onChange={(e) => setAdditionalRate(r.key, parseFloat(e.target.value) || 0)}
                          className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-navy">{peso(r.total)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                        {r.status === "paid" && r.paymentMethod && (
                          <div className="text-xs text-gray-500 mt-1">
                            via {r.paymentMethod === "online" ? "Online" : r.paymentMethod === "card" ? "Card" : "Cash"}
                            {r.paymentMethod === "online" && r.channelLabel ? ` · ${r.channelLabel}` : ""}
                          </div>
                        )}
                        {!r.isSaved && <UnsavedBadge />}
                        {r.justSaved && <div className="text-xs text-green mt-1">Saved.</div>}
                        {errorKey === r.key && <div className="text-xs text-red mt-1">Could not save.</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => persist(r, false)}
                            disabled={pending && pendingKey === r.key}
                            className="px-2.5 py-1 text-xs font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
                          >
                            Save
                          </button>
                          {r.status !== "paid" && (
                            <button
                              onClick={() => markPaid(r)}
                              disabled={pending && pendingKey === r.key}
                              className="px-2.5 py-1 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-60"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-navy">
                    <td className="px-4 py-3" colSpan={4}>
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right">{peso(totals.commission)}</td>
                    <td className="px-4 py-3 text-right">{peso(totals.additionalRate)}</td>
                    <td className="px-4 py-3 text-right">{peso(totals.total)}</td>
                    <td className="px-4 py-3" colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Parent remounts this component (via a `key` tied to the applied date
// range) whenever `data` is reloaded, so plain useState initializers are
// enough — no effect needed to re-sync local state with a new `data` prop.
// Every commission save/status-change also nudges Overview's Outstanding/
// Paid figures (sourced from this same table) so they don't go stale
// without a manual date-range re-apply — same sibling-tab refetch pattern
// this codebase already uses for Divers > Group/Individual Management.
// refreshOverview is passed through to Leader/EducatorTable and called only
// after a real persisted save, not on every keystroke of a live edit.
export function StaffTab({ data, refreshOverview }: { data: StaffActivityData; refreshOverview?: () => void }) {
  const [leaderRows, setLeaderRows] = useState<EditableLeaderRow[]>(() => withEditable(data.leaderRows));
  const [educatorRows, setEducatorRows] = useState<EditableEducatorRow[]>(() => withEditable(data.educatorRows));

  return (
    <div className="grid gap-5">
      <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
        Staff Activity Summary is a reference for commissions. Commission and Additional Rate are both entered by
        hand — AquaDesk only tallies the divers, dives, and rate paid.
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">Leading Our Dives</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Every staff member (divemaster, instructor, or freelancer) who guided a Fun Diving trip in this date
            range — including trips already assigned in Scheduling, not yet Boat Returned.
          </div>
        </div>
        <LeaderTable
          allRows={leaderRows}
          setRows={setLeaderRows}
          refreshOverview={refreshOverview}
          customChannels={data.customChannels}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">Our Dive Educators</div>
          <div className="text-xs text-gray-500 mt-0.5">
            One row per student per day of a completed course activity — the same instructor can also appear in
            Leading Our Dives if they guided a fun dive during this period.
          </div>
        </div>
        <EducatorTable
          allRows={educatorRows}
          setRows={setEducatorRows}
          refreshOverview={refreshOverview}
          customChannels={data.customChannels}
        />
      </div>
    </div>
  );
}
