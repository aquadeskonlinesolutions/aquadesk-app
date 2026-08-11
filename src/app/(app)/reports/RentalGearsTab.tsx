"use client";

import { useState, useTransition } from "react";
import { getRentalGearsData, saveRentalGearRecord, updateRentalGearStatus, deleteRentalGearRecord } from "./actions";
import { EQUIPMENT_SUGGESTIONS } from "./constants";
import type { RentalGearRecord, RentalGearsData } from "./data";
import { useConfirm } from "@/components/ui/ConfirmDialog";

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
  collected: "Collected",
  to_pay: "To Pay",
  paid: "Paid",
};

function isSettled(status: string): boolean {
  return status === "collected" || status === "paid";
}

function StatusPill({ status }: { status: string }) {
  const settled = isSettled(status);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        settled ? "bg-green-light text-green" : "bg-orange-light text-orange"
      }`}
    >
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
  equipment: string;
  company: string;
  quantity: string;
  rate: string;
  status: string;
  remarks: string;
};

function emptyForm(): FormState {
  return {
    id: null,
    date: new Date().toISOString().slice(0, 10),
    equipment: "",
    company: "",
    quantity: "0",
    rate: "0",
    status: "to_collect",
    remarks: "",
  };
}

export function RentalGearsTab({
  data,
  appliedFrom,
  appliedTo,
  refreshOverview,
}: {
  data: RentalGearsData;
  appliedFrom: string;
  appliedTo: string;
  refreshOverview?: () => void;
}) {
  const confirm = useConfirm();
  const [records, setRecords] = useState<RentalGearRecord[]>(data.records);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const fresh = await getRentalGearsData();
    setRecords(fresh.records);
  }

  const income = records.filter((r) => r.status === "collected").reduce((s, r) => s + r.totalAmount, 0);
  const expense = records.filter((r) => r.status === "paid").reduce((s, r) => s + r.totalAmount, 0);
  const stillToCollect = records.filter((r) => r.status === "to_collect").reduce((s, r) => s + r.balance, 0);
  const stillToPay = records.filter((r) => r.status === "to_pay").reduce((s, r) => s + r.balance, 0);
  const netBalance = income + stillToCollect - expense - stillToPay;

  const tableRows = records
    .filter((r) => r.date >= appliedFrom && r.date <= appliedTo)
    .sort((a, b) => b.date.localeCompare(a.date));

  function startAdd() {
    setForm(emptyForm());
    setFormError(null);
  }
  function startEdit(r: RentalGearRecord) {
    setForm({
      id: r.id,
      date: r.date,
      equipment: r.equipment,
      company: r.company ?? "",
      quantity: String(r.quantity),
      rate: String(r.rate),
      status: r.status,
      remarks: r.remarks ?? "",
    });
    setFormError(null);
  }

  function saveForm() {
    if (!form) return;
    startTransition(async () => {
      const res = await saveRentalGearRecord(
        form.id,
        form.date,
        form.equipment,
        form.company,
        parseInt(form.quantity, 10) || 0,
        parseFloat(form.rate) || 0,
        form.status,
        form.remarks,
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

  function changeStatus(id: string, status: string) {
    setRowPending(id);
    startTransition(async () => {
      await updateRentalGearStatus(id, status);
      await refresh();
      refreshOverview?.();
      setRowPending(null);
    });
  }

  async function settleRecord(id: string, status: "collected" | "paid") {
    const label = status === "collected" ? "Collected" : "Paid";
    const ok = await confirm(`Once marked as ${label}, this record can still be edited but can no longer be deleted.`, {
      title: `Mark as ${label}?`,
      confirmLabel: `Mark ${label}`,
    });
    if (!ok) return;
    changeStatus(id, status);
  }

  function removeRecord(id: string) {
    startTransition(async () => {
      setRowPending(id);
      const res = await deleteRentalGearRecord(id);
      if (!res.error) {
        await refresh();
        refreshOverview?.();
      }
      setRowPending(null);
    });
  }

  const estimatedBalance = form ? (parseInt(form.quantity, 10) || 0) * (parseFloat(form.rate) || 0) : 0;

  return (
    <div className="grid gap-5">
      <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
        Rental Gears tracks tanks, equipment, and peripherals rented between dive centers. Use To Collect /
        Collected for money in, and To Pay / Paid for money out.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Rental Income" value={peso(income)} sub="Collected" accent="green" />
        <StatCard label="Rental Expense" value={peso(expense)} sub="Paid out" accent="green" />
        <StatCard label="Still To Collect" value={peso(stillToCollect)} sub="Money in pending" accent="orange" />
        <StatCard label="Still To Pay" value={peso(stillToPay)} sub="Money out pending" accent="orange" />
        <StatCard label="Net Rental Balance" value={peso(netBalance)} sub="Income − expense" accent="teal" />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-extrabold text-navy">Rental Gear Records</div>
            <div className="text-xs text-gray-500 mt-0.5">Quantity × rate = balance.</div>
          </div>
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark"
          >
            + Add Rental Record
          </button>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Equipment</label>
                <input
                  list="equipment-suggestions"
                  value={form.equipment}
                  onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                  placeholder="e.g. BCD"
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
                <datalist id="equipment-suggestions">
                  {EQUIPMENT_SUGGESTIONS.map((eq) => (
                    <option key={eq} value={eq} />
                  ))}
                </datalist>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                <input
                  type="number"
                  onFocus={(e) => e.currentTarget.select()}
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rate</label>
                <input
                  type="number"
                  onFocus={(e) => e.currentTarget.select()}
                  min={0}
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Balance (auto)</label>
                <input
                  readOnly
                  value={peso(estimatedBalance)}
                  className="w-full border border-gray-200 bg-gray-100 rounded-md px-2.5 py-1.5 text-sm text-gray-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                {isSettled(form.status) ? (
                  <div className="w-full border border-gray-200 bg-gray-100 rounded-md px-2.5 py-1.5 text-sm text-gray-600">
                    {STATUS_LABELS[form.status]} (settled)
                  </div>
                ) : (
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    {/* Collected/Paid are deliberately excluded — settlement only
                        happens through the dedicated action button + confirmation
                        below, never a plain dropdown pick (also true at creation:
                        a new record can only start as To Collect or To Pay). */}
                    {(["to_collect", "to_pay"] as const).map((value) => (
                      <option key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
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
                  Equipment
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Company</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Quantity
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Rate
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Balance
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Remarks</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400 text-sm">
                    No rental records for the selected date range.
                  </td>
                </tr>
              ) : (
                tableRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 font-semibold text-navy">{r.equipment}</td>
                    <td className="px-4 py-3">{r.company || "—"}</td>
                    <td className="px-4 py-3 text-right">{r.quantity}</td>
                    <td className="px-4 py-3 text-right">{peso(r.rate)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">{peso(r.balance)}</td>
                    <td className="px-4 py-3 text-gray-500">{r.remarks || ""}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => startEdit(r)} className="text-xs text-teal hover:text-navy">
                          Edit
                        </button>
                        {!isSettled(r.status) && (
                          <>
                            {r.status === "to_collect" && (
                              <button
                                onClick={() => settleRecord(r.id, "collected")}
                                disabled={pending && rowPending === r.id}
                                className="text-xs font-medium text-green hover:underline disabled:opacity-60"
                              >
                                Mark Collected
                              </button>
                            )}
                            {r.status === "to_pay" && (
                              <button
                                onClick={() => settleRecord(r.id, "paid")}
                                disabled={pending && rowPending === r.id}
                                className="text-xs font-medium text-green hover:underline disabled:opacity-60"
                              >
                                Mark Paid
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
    </div>
  );
}
