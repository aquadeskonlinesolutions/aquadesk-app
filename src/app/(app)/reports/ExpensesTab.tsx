"use client";

import { useState, useTransition } from "react";
import { getExpensesData, saveExpenseRecord, deleteExpenseRecord } from "./actions";
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "./constants";
import type { ExpenseRecord, ExpensesData } from "./data";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function categoryLabel(category: string, customCategory: string | null): string {
  if (category === "other") {
    const custom = customCategory?.trim();
    return custom ? `Other – ${custom}` : "Other (unspecified)";
  }
  return EXPENSE_CATEGORY_LABELS[category] ?? "Uncategorized";
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

function BarList({ items }: { items: { name: string; amount: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.amount));
  if (items.length === 0) {
    return <div className="text-center py-6 text-gray-500 text-sm">No expenses recorded for this period.</div>;
  }
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item.name} className="grid grid-cols-[160px_1fr_80px] gap-3 items-center">
          <div className="text-sm font-bold text-navy truncate">{item.name}</div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal to-navy-mid rounded-full"
              style={{ width: `${Math.max(4, (item.amount / max) * 100)}%` }}
            />
          </div>
          <div className="text-xs font-extrabold text-gray-600 text-right">{peso(item.amount)}</div>
        </div>
      ))}
    </div>
  );
}

type FormState = {
  id: string | null;
  date: string;
  category: string;
  customCategory: string;
  amount: string;
  paymentMethod: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    id: null,
    date: new Date().toISOString().slice(0, 10),
    category: "fuel",
    customCategory: "",
    amount: "0",
    paymentMethod: "cash",
    notes: "",
  };
}

export function ExpensesTab({
  data,
  appliedFrom,
  appliedTo,
}: {
  data: ExpensesData;
  appliedFrom: string;
  appliedTo: string;
}) {
  const [records, setRecords] = useState<ExpenseRecord[]>(data.records);
  const [categoryTotals, setCategoryTotals] = useState(data.categoryTotals);
  const [totalAmount, setTotalAmount] = useState(data.totalAmount);
  const [uncategorizedAmount, setUncategorizedAmount] = useState(data.uncategorizedAmount);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyFresh(fresh: ExpensesData) {
    setRecords(fresh.records);
    setCategoryTotals(fresh.categoryTotals);
    setTotalAmount(fresh.totalAmount);
    setUncategorizedAmount(fresh.uncategorizedAmount);
  }

  const topCategory = categoryTotals[0];

  function startAdd() {
    setForm(emptyForm());
    setFormError(null);
  }
  function startEdit(r: ExpenseRecord) {
    setForm({
      id: r.id,
      date: r.date,
      category: r.category,
      customCategory: r.customCategory ?? "",
      amount: String(r.amount),
      paymentMethod: r.paymentMethod ?? "cash",
      notes: r.notes ?? "",
    });
    setFormError(null);
  }

  function saveForm() {
    if (!form) return;
    startTransition(async () => {
      const res = await saveExpenseRecord(
        form.id,
        form.date,
        form.category,
        form.customCategory,
        parseFloat(form.amount) || 0,
        form.paymentMethod,
        form.notes,
      );
      if (res.error) {
        setFormError(res.error);
      } else {
        setForm(null);
        setFormError(null);
        // Refetching the full computed set (records + category bars + cards)
        // is simpler and less error-prone than patching all four locally,
        // and expenses lists are small enough that a round-trip is cheap.
        applyFresh(await getExpensesData(appliedFrom, appliedTo));
      }
    });
  }

  function removeRecord(r: ExpenseRecord) {
    setRowPending(r.id);
    startTransition(async () => {
      await deleteExpenseRecord(r.id);
      applyFresh(await getExpensesData(appliedFrom, appliedTo));
      setRowPending(null);
    });
  }

  const estimatedAmount = form ? parseFloat(form.amount) || 0 : 0;

  return (
    <div className="grid gap-5">
      <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
        Log dive center expenses outside of diver fees — fuel, maintenance, supplies, and more. Pick a category
        so spending stays easy to analyze; use &quot;Uncategorized&quot; if you&apos;re not sure yet, it still
        counts toward your totals.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Expenses"
          value={peso(totalAmount)}
          sub={`${records.length} ${records.length === 1 ? "entry" : "entries"} this period`}
          accent="teal"
        />
        <StatCard
          label="Uncategorized"
          value={peso(uncategorizedAmount)}
          sub="Still counted, not yet labeled"
          accent="orange"
        />
        <StatCard
          label="Top Category"
          value={topCategory ? peso(topCategory.amount) : "₱0"}
          sub={topCategory ? topCategory.name : "No expenses yet"}
          accent="teal"
        />
        <StatCard label="Entries Logged" value={String(records.length)} sub="For the selected range" accent="green" />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">Expenses by Category</div>
          <div className="text-xs text-gray-500 mt-0.5">Total spend per category for the selected date range.</div>
        </div>
        <div className="p-5">
          <BarList items={categoryTotals} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-extrabold text-navy">Expense Records</div>
            <div className="text-xs text-gray-500 mt-0.5">Manual entries for the selected date range.</div>
          </div>
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark"
          >
            + Add Expense
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {form.category === "other" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Specify Category</label>
                  <input
                    value={form.customCategory}
                    onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                    placeholder="e.g. Boat repaint"
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                <input
                  type="number"
                  onFocus={(e) => e.currentTarget.select()}
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm min-h-[70px]"
              />
            </div>
            <div className="text-xs text-gray-500 mb-3">Amount to save: {peso(estimatedAmount)}</div>
            <div className="flex gap-2">
              <button
                onClick={saveForm}
                disabled={pending}
                className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
              >
                Save Expense
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
                  Category
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Amount
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Payment Method
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Recorded By
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                    No expenses recorded for the selected date range.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 font-semibold text-navy">
                      {categoryLabel(r.category, r.customCategory)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">{peso(r.amount)}</td>
                    <td className="px-4 py-3">
                      {r.paymentMethod ? PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod : "—"}
                    </td>
                    <td className="px-4 py-3">{r.recordedBy}</td>
                    <td className="px-4 py-3 text-gray-500">{r.notes || ""}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)} className="text-xs text-teal hover:text-navy">
                          Edit
                        </button>
                        <button
                          onClick={() => removeRecord(r)}
                          disabled={pending && rowPending === r.id}
                          className="text-xs text-red hover:underline disabled:opacity-60"
                        >
                          Delete
                        </button>
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
