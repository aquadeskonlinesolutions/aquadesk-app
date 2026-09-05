"use client";

import { useState, useTransition } from "react";
import {
  generateJoinRideStatement,
  getJoinRideData,
  saveJoinRideRecord,
  updateJoinRideStatus,
  deleteJoinRideRecord,
} from "./actions";
import type { JoinRideData, JoinRideDirection, JoinRideRecord } from "./data";
import type { StatementLineItem } from "./actions";
import { useSettlePayment } from "@/components/ui/SettlePaymentDialog";
import { PAYMENT_CHANNEL_LABELS, type PaymentChannel } from "@/lib/payments";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  to_collect: "To Collect",
  statement_printed: "Statement Printed",
  collected: "Collected",
  expected_to_pay: "Expected To Pay",
  statement_received: "Statement Received",
  paid: "Paid",
};

const STATUS_OPTIONS: Record<JoinRideDirection, string[]> = {
  joined_our_boat: ["to_collect", "statement_printed", "collected"],
  we_joined_another_boat: ["expected_to_pay", "statement_received", "paid"],
};

function isSettled(status: string): boolean {
  return status === "collected" || status === "paid";
}

function StatusPill({ status }: { status: string }) {
  const settled = status === "collected" || status === "paid";
  const pending = status === "to_collect" || status === "expected_to_pay";
  const cls = settled
    ? "bg-green-light text-green"
    : pending
      ? "bg-orange-light text-orange"
      : "bg-teal-light text-teal-mid";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "orange" | "green" | "teal";
}) {
  const barColor = accent === "orange" ? "bg-orange" : accent === "green" ? "bg-green" : "bg-teal";
  return (
    <div className="relative bg-white border border-gray-200 rounded-2xl shadow-sm p-5 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${barColor}`} />
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{label}</div>
      <div className="font-display text-2xl text-navy mb-1">{value}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </div>
  );
}

type FormState = {
  id: string | null;
  date: string;
  company: string;
  numberOfDivers: string;
  numberOfDives: string;
  diveSites: string;
  remarks: string;
  status: string;
};

function emptyForm(direction: JoinRideDirection): FormState {
  return {
    id: null,
    date: new Date().toISOString().slice(0, 10),
    company: "",
    numberOfDivers: "0",
    numberOfDives: "0",
    diveSites: "",
    remarks: "",
    status: STATUS_OPTIONS[direction][0],
  };
}

export function JoinRideTab({
  data,
  appliedFrom,
  appliedTo,
  currentUserName,
  refreshOverview,
}: {
  data: JoinRideData;
  appliedFrom: string;
  appliedTo: string;
  currentUserName: string;
  refreshOverview?: () => void;
}) {
  const settlePayment = useSettlePayment();
  const [records, setRecords] = useState<JoinRideRecord[]>(data.records);
  const [direction, setDirection] = useState<JoinRideDirection>("joined_our_boat");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [stmtOpen, setStmtOpen] = useState(false);
  const [stmtCompany, setStmtCompany] = useState("");
  const [stmtFrom, setStmtFrom] = useState(appliedFrom);
  const [stmtTo, setStmtTo] = useState(appliedTo);
  const [stmtStatus, setStmtStatus] = useState<"to_collect" | "statement_printed">("to_collect");
  const [stmtError, setStmtError] = useState<string | null>(null);
  const [stmtPending, setStmtPending] = useState(false);
  const [generatedStatement, setGeneratedStatement] = useState<{
    company: string;
    dateFrom: string;
    dateTo: string;
    lineItems: StatementLineItem[];
    total: number;
  } | null>(null);

  async function refresh() {
    const fresh = await getJoinRideData();
    setRecords(fresh.records);
  }

  const inRange = (r: JoinRideRecord) => r.date >= appliedFrom && r.date <= appliedTo;

  // "collect"/"pay" drive the summary cards, so they're scoped to the
  // applied date range — per the user's explicit choice, an outstanding
  // balance card only reflects records dated inside the picked range, not
  // an all-time running balance. "allCollect" stays unscoped: it's what
  // feeds the statement generator's company picker below, which has its
  // own independent date range (stmtFrom/stmtTo) and shouldn't be limited
  // by whatever range happens to be applied on the page right now.
  const allCollect = records.filter((r) => r.direction === "joined_our_boat");
  const collect = allCollect.filter(inRange);
  const pay = records.filter((r) => r.direction === "we_joined_another_boat" && inRange(r));
  const toCollect = collect.filter((r) => r.status !== "collected").reduce((s, r) => s + r.balance, 0);
  const collected = collect.filter((r) => r.status === "collected").reduce((s, r) => s + r.totalAmount, 0);
  const toPay = pay.filter((r) => r.status !== "paid").reduce((s, r) => s + r.balance, 0);
  const paid = pay.filter((r) => r.status === "paid").reduce((s, r) => s + r.totalAmount, 0);
  const joinerDives = [...collect, ...pay].reduce((s, r) => s + r.numberOfDivers * r.numberOfDives, 0);

  const directionDateRows = records.filter((r) => r.direction === direction && inRange(r));
  const companyOptions = [...new Set(directionDateRows.map((r) => r.company))].sort((a, b) => a.localeCompare(b));

  const tableRows = directionDateRows
    .filter((r) => !companyFilter || r.company === companyFilter)
    .filter((r) => !statusFilter || r.status === statusFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const statementCompanies = [...new Set(allCollect.filter((r) => r.status !== "collected").map((r) => r.company))].sort(
    (a, b) => a.localeCompare(b),
  );

  const statementPreview = stmtCompany
    ? collect
        .filter(
          (r) =>
            r.company === stmtCompany && r.status === stmtStatus && r.date >= stmtFrom && r.date <= stmtTo,
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const statementPreviewTotal = statementPreview.reduce((s, r) => s + r.totalAmount, 0);

  function startAdd() {
    setForm(emptyForm(direction));
    setFormError(null);
  }
  function startEdit(r: JoinRideRecord) {
    setForm({
      id: r.id,
      date: r.date,
      company: r.company,
      numberOfDivers: String(r.numberOfDivers),
      numberOfDives: String(r.numberOfDives),
      diveSites: r.diveSites ?? "",
      remarks: r.remarks ?? "",
      status: r.status,
    });
    setFormError(null);
  }

  function saveForm() {
    if (!form) return;
    startTransition(async () => {
      const res = await saveJoinRideRecord(
        form.id,
        direction,
        form.date,
        form.company,
        parseInt(form.numberOfDivers, 10) || 0,
        parseInt(form.numberOfDives, 10) || 0,
        form.diveSites,
        form.remarks,
        form.status,
      );
      if (res.error) {
        setFormError(res.error);
      } else {
        setForm(null);
        setFormError(null);
        await refresh();
        refreshOverview?.();
      }
    });
  }

  function changeStatus(
    id: string,
    status: string,
    paymentMethod?: "cash" | "card" | "online" | null,
    channel?: PaymentChannel | null,
  ) {
    setRowPending(id);
    startTransition(async () => {
      await updateJoinRideStatus(id, status, paymentMethod, channel);
      await refresh();
      refreshOverview?.();
      setRowPending(null);
    });
  }

  async function settleRecord(id: string, status: "collected" | "paid") {
    const label = status === "collected" ? "Collected" : "Paid";
    const result = await settlePayment(
      `Once marked as ${label}, this record can still be edited but can no longer be deleted.`,
      { title: `Mark as ${label}?`, confirmLabel: `Mark ${label}` },
    );
    if (!result) return;
    changeStatus(id, status, result.method, result.channel);
  }

  function removeRecord(id: string) {
    startTransition(async () => {
      setRowPending(id);
      const res = await deleteJoinRideRecord(id);
      if (!res.error) {
        await refresh();
        refreshOverview?.();
      }
      setRowPending(null);
    });
  }

  function openStatementGenerator() {
    setStmtOpen(true);
    setStmtCompany(statementCompanies[0] ?? "");
    setStmtFrom(appliedFrom);
    setStmtTo(appliedTo);
    setStmtStatus("to_collect");
    setStmtError(null);
    setGeneratedStatement(null);
  }

  function generateStatement() {
    setStmtPending(true);
    setStmtError(null);
    startTransition(async () => {
      const res = await generateJoinRideStatement(stmtCompany, stmtFrom, stmtTo, stmtStatus, currentUserName);
      if (res.error || !res.lineItems) {
        setStmtError(res.error ?? "Could not generate statement.");
      } else {
        setGeneratedStatement({
          company: stmtCompany,
          dateFrom: stmtFrom,
          dateTo: stmtTo,
          lineItems: res.lineItems,
          total: res.total ?? 0,
        });
        await refresh();
      }
      setStmtPending(false);
    });
  }

  const estimatedTotal = form
    ? (parseInt(form.numberOfDivers, 10) || 0) *
      (parseInt(form.numberOfDives, 10) || 0) *
      data.joinRideRatePerDiverPerDive
    : 0;

  return (
    <div>
      <div className="print:hidden grid gap-5">
        <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
          Join ride rate: {peso(data.joinRideRatePerDiverPerDive)} per diver per dive (set in Settings &gt;
          Pricing &amp; Rates). Records are saved per trip/day, then statements can be grouped by company and
          date range.
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="To Collect" value={peso(toCollect)} sub="Uncollected join rides" accent="orange" />
          <StatCard label="Collected" value={peso(collected)} sub="Money in" accent="green" />
          <StatCard label="To Pay" value={peso(toPay)} sub="Expected / outstanding" accent="orange" />
          <StatCard label="Paid" value={peso(paid)} sub="Money out" accent="green" />
          <StatCard
            label="Joiner Dives"
            value={String(joinerDives)}
            sub="Divers × dives, selected range"
            accent="teal"
          />
        </div>

        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm w-fit">
          {(["joined_our_boat", "we_joined_another_boat"] as const).map((d) => (
            <button
              key={d}
              onClick={() => {
                setDirection(d);
                setForm(null);
                setCompanyFilter("");
                setStatusFilter("");
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                direction === d ? "bg-navy text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {d === "joined_our_boat" ? "They Joined Our Boat" : "We Joined Another Boat"}
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-extrabold text-navy">
                {direction === "joined_our_boat" ? "They Joined Our Boat" : "We Joined Another Boat"}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {direction === "joined_our_boat"
                  ? "Money to collect from partner companies."
                  : "Money to pay when partner companies send paperwork."}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startAdd}
                className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark"
              >
                + Add Join Ride Record
              </button>
              {direction === "joined_our_boat" && (
                <button
                  onClick={openStatementGenerator}
                  className="px-3 py-1.5 text-xs font-medium bg-teal text-white rounded-md hover:bg-teal-mid"
                >
                  Generate Collection Statement
                </button>
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-b border-gray-200 bg-off-white flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filter</span>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">All companies</option>
              {companyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS[direction].map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            {(companyFilter || statusFilter) && (
              <button
                onClick={() => {
                  setCompanyFilter("");
                  setStatusFilter("");
                }}
                className="text-xs text-teal hover:text-navy"
              >
                Clear filters
              </button>
            )}
          </div>

          {form && (
            <div className="p-5 border-b border-gray-200 bg-off-white">
              {formError && <div className="mb-3 text-sm text-red">{formError}</div>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Company name"
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  {!form.id ? (
                    <div className="w-full border border-gray-200 bg-gray-100 rounded-md px-2.5 py-1.5 text-sm text-gray-600">
                      Starts as: {STATUS_LABELS[STATUS_OPTIONS[direction][0]]}
                    </div>
                  ) : isSettled(form.status) ? (
                    <div className="w-full border border-gray-200 bg-gray-100 rounded-md px-2.5 py-1.5 text-sm text-gray-600">
                      {STATUS_LABELS[form.status]} (settled)
                    </div>
                  ) : (
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                    >
                      {/* Settled (Collected/Paid) is deliberately excluded here — that
                          transition only happens through the dedicated action button
                          + confirmation below, never a plain dropdown pick. */}
                      {STATUS_OPTIONS[direction]
                        .filter((s) => !isSettled(s))
                        .map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Number of Divers</label>
                  <input
                    type="number"
                    onFocus={(e) => e.currentTarget.select()}
                    min={0}
                    value={form.numberOfDivers}
                    onChange={(e) => setForm({ ...form, numberOfDivers: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Number of Dives</label>
                  <input
                    type="number"
                    onFocus={(e) => e.currentTarget.select()}
                    min={0}
                    value={form.numberOfDives}
                    onChange={(e) => setForm({ ...form, numberOfDives: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total (auto)</label>
                  <input
                    readOnly
                    value={peso(estimatedTotal)}
                    className="w-full border border-gray-200 bg-gray-100 rounded-md px-2.5 py-1.5 text-sm text-gray-600"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Dive Site(s)</label>
                <input
                  value={form.diveSites}
                  onChange={(e) => setForm({ ...form, diveSites: e.target.value })}
                  placeholder="Kimud, Monad, Gato"
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Optional notes"
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm min-h-[70px]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveForm}
                  disabled={pending}
                  className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
                >
                  Save Record
                </button>
                <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Company
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                    Divers
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                    Dives
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Dive Site(s)
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Remarks
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-400 text-sm">
                      {directionDateRows.length === 0
                        ? "No join ride records for the selected date range."
                        : "No join ride records match the current filters."}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 font-semibold text-navy">{r.company}</td>
                      <td className="px-4 py-3 text-right">{r.numberOfDivers}</td>
                      <td className="px-4 py-3 text-right">{r.numberOfDives}</td>
                      <td className="px-4 py-3">{r.diveSites || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-navy">{peso(r.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                        {isSettled(r.status) && r.paymentMethod && (
                          <div className="text-xs text-gray-500 mt-1">
                            via {r.paymentMethod === "online" ? "Online" : r.paymentMethod === "card" ? "Card" : "Cash"}
                            {r.paymentMethod === "online" && r.channel ? ` · ${PAYMENT_CHANNEL_LABELS[r.channel]}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{peso(r.balance)}</td>
                      <td className="px-4 py-3 text-gray-500">{r.remarks || ""}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => startEdit(r)} className="text-xs text-teal hover:text-navy">
                            Edit
                          </button>
                          {!isSettled(r.status) && (
                            <>
                              {r.direction === "joined_our_boat" && (
                                <button
                                  onClick={() => settleRecord(r.id, "collected")}
                                  disabled={pending && rowPending === r.id}
                                  className="text-xs font-medium text-green hover:underline disabled:opacity-60"
                                >
                                  Collected
                                </button>
                              )}
                              {r.direction === "we_joined_another_boat" && r.status === "expected_to_pay" && (
                                <button
                                  onClick={() => changeStatus(r.id, "statement_received")}
                                  disabled={pending && rowPending === r.id}
                                  className="text-xs font-medium text-teal-mid hover:underline disabled:opacity-60"
                                >
                                  Statement Received
                                </button>
                              )}
                              {r.direction === "we_joined_another_boat" && (
                                <button
                                  onClick={() => settleRecord(r.id, "paid")}
                                  disabled={pending && rowPending === r.id}
                                  className="text-xs font-medium text-green hover:underline disabled:opacity-60"
                                >
                                  Paid
                                </button>
                              )}
                              <button
                                onClick={() => removeRecord(r.id)}
                                disabled={pending && rowPending === r.id}
                                className="text-xs font-medium text-red hover:underline disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {stmtOpen && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="text-sm font-extrabold text-navy">Generate Collection Statement</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Group To Collect join rides by company and date range, then print one statement.
              </div>
            </div>
            <div className="p-5">
              {stmtError && <div className="mb-3 text-sm text-red">{stmtError}</div>}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                  <select
                    value={stmtCompany}
                    onChange={(e) => setStmtCompany(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    {statementCompanies.length === 0 ? (
                      <option value="">No company</option>
                    ) : (
                      statementCompanies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date From</label>
                  <input
                    type="date"
                    value={stmtFrom}
                    onChange={(e) => setStmtFrom(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date To</label>
                  <input
                    type="date"
                    value={stmtTo}
                    onChange={(e) => setStmtTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={stmtStatus}
                    onChange={(e) => setStmtStatus(e.target.value as "to_collect" | "statement_printed")}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    <option value="to_collect">To Collect</option>
                    <option value="statement_printed">Statement Printed</option>
                  </select>
                </div>
              </div>

              {statementPreview.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm border border-gray-200 rounded-xl">
                  No matching records for this company, date range, and status.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-400">Date</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-400">Site(s)</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-400 text-right">
                          Divers
                        </th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-400 text-right">
                          Dives
                        </th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-400 text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementPreview.map((r) => (
                        <tr key={r.id} className="border-t border-gray-100">
                          <td className="px-3 py-2">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2">{r.diveSites || "—"}</td>
                          <td className="px-3 py-2 text-right">{r.numberOfDivers}</td>
                          <td className="px-3 py-2 text-right">{r.numberOfDives}</td>
                          <td className="px-3 py-2 text-right font-semibold text-navy">{peso(r.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-teal-light text-right font-semibold text-navy">
                    Total to Collect: {peso(statementPreviewTotal)}
                  </div>
                </div>
              )}

              {generatedStatement && (
                <div className="mt-4 mb-2 text-sm text-green bg-green-light rounded-lg px-3 py-2">
                  Statement generated for {generatedStatement.company} ({peso(generatedStatement.total)}) — matching
                  records marked as Statement Printed. Review the copies below, then print.
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={generateStatement}
                  disabled={stmtPending || statementPreview.length === 0}
                  className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-50"
                >
                  {stmtPending ? "Generating…" : "Generate Statement"}
                </button>
                {generatedStatement && (
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid"
                  >
                    🖨 Print Statement
                  </button>
                )}
                <button onClick={() => setStmtOpen(false)} className="px-4 py-2 text-sm text-gray-600">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {generatedStatement && (
        <div className="hidden print:block">
          {[
            { label: "Dive Center Copy" },
            { label: "Company Copy" },
          ].map((copy, i) => (
            <div key={copy.label} style={{ breakAfter: i === 0 ? "page" : "auto" }} className="p-6">
              <div className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2">
                {copy.label}
              </div>
              <div className="font-display text-2xl text-navy mb-2">Join Ride Collection Statement</div>
              <div className="text-sm text-gray-600 mb-4">
                From: <strong>{data.diveCenterName}</strong> &nbsp; To:{" "}
                <strong>{generatedStatement.company}</strong>
                <br />
                Date Range: {fmtDate(generatedStatement.dateFrom)} – {fmtDate(generatedStatement.dateTo)}{" "}
                &nbsp; Statement Date: {fmtDate(new Date().toISOString().slice(0, 10))}
              </div>
              <table className="w-full text-sm border border-gray-300 mb-4">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="px-3 py-2 border-b border-gray-300">Date</th>
                    <th className="px-3 py-2 border-b border-gray-300">Dive Site(s)</th>
                    <th className="px-3 py-2 border-b border-gray-300 text-right">Divers</th>
                    <th className="px-3 py-2 border-b border-gray-300 text-right">Dives</th>
                    <th className="px-3 py-2 border-b border-gray-300 text-right">Rate</th>
                    <th className="px-3 py-2 border-b border-gray-300 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedStatement.lineItems.map((r, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 border-b border-gray-200">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2 border-b border-gray-200">{r.diveSites || "—"}</td>
                      <td className="px-3 py-2 border-b border-gray-200 text-right">{r.numberOfDivers}</td>
                      <td className="px-3 py-2 border-b border-gray-200 text-right">{r.numberOfDives}</td>
                      <td className="px-3 py-2 border-b border-gray-200 text-right">
                        {peso(data.joinRideRatePerDiverPerDive)}
                      </td>
                      <td className="px-3 py-2 border-b border-gray-200 text-right">{peso(r.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end mb-6">
                <div className="min-w-[240px] bg-gray-100 p-3 rounded">
                  <div className="text-xs text-gray-500">Total to Collect</div>
                  <div className="font-display text-xl text-navy">{peso(generatedStatement.total)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mt-8 text-xs text-gray-500">
                <div className="border-t border-gray-400 pt-1">Prepared by — {currentUserName}</div>
                <div className="border-t border-gray-400 pt-1">Received by</div>
                <div className="border-t border-gray-400 pt-1">Date Received</div>
                <div className="border-t border-gray-400 pt-1">Signature</div>
              </div>
              <div className="border-t border-gray-400 pt-1 mt-4 text-xs text-gray-500">Remarks</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
