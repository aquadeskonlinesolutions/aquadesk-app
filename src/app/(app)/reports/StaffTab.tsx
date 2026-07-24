"use client";

import { useState, useTransition } from "react";
import { saveDiveLeaderCommission, saveInstructorCommission } from "./actions";
import type { EducatorCommissionRow, LeaderCommissionRow, StaffActivityData } from "./data";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function StatusPill({ status }: { status: "unpaid" | "paid" }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        status === "paid" ? "bg-green-light text-green" : "bg-orange-light text-orange"
      }`}
    >
      {status === "paid" ? "Paid" : "Unpaid"}
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

function BulkMarkPaidButton({ unpaidCount, onClick, pending }: { unpaidCount: number; onClick: () => void; pending: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending || unpaidCount === 0}
      className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-40"
    >
      {pending ? "Marking…" : `Mark All Unpaid as Paid (${unpaidCount})`}
    </button>
  );
}

function LeaderTable({
  rows,
  setRows,
  ratioBonusEnabled,
}: {
  rows: EditableLeaderRow[];
  setRows: (updater: (prev: EditableLeaderRow[]) => EditableLeaderRow[]) => void;
  ratioBonusEnabled: boolean;
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [pending, startTransition] = useTransition();

  function setRate(key: string, rate: number) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, rate, amount: r.dives * rate + r.bonusAmount, justSaved: false } : r)),
    );
  }
  function setBonus(key: string, bonusAmount: number) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, bonusAmount, amount: r.dives * r.rate + bonusAmount, justSaved: false } : r)),
    );
  }

  function saveRow(row: EditableLeaderRow, markPaid: boolean) {
    setPendingKey(row.key);
    setErrorKey(null);
    startTransition(async () => {
      const res = await saveDiveLeaderCommission(
        row.date,
        row.staffName,
        row.site,
        row.dives,
        row.divers,
        row.rate,
        row.bonusAmount,
        markPaid,
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
                  rate: res.rate!,
                  bonusAmount: res.bonusAmount!,
                  amount: res.amount!,
                  justSaved: !markPaid,
                }
              : r,
          ),
        );
      }
      setPendingKey(null);
    });
  }

  async function markAllUnpaid() {
    setBulkPending(true);
    const unpaid = rows.filter((r) => r.status === "unpaid");
    await Promise.all(
      unpaid.map(async (row) => {
        const res = await saveDiveLeaderCommission(
          row.date,
          row.staffName,
          row.site,
          row.dives,
          row.divers,
          row.rate,
          row.bonusAmount,
          true,
        );
        if (!res.error) {
          setRows((prev) =>
            prev.map((r) =>
              r.key === row.key
                ? { ...r, status: res.status!, rate: res.rate!, bonusAmount: res.bonusAmount!, amount: res.amount!, justSaved: false }
                : r,
            ),
          );
        }
      }),
    );
    setBulkPending(false);
  }

  return (
    <div>
      <div className="px-5 py-3 flex justify-end">
        <BulkMarkPaidButton
          unpaidCount={rows.filter((r) => r.status === "unpaid").length}
          onClick={markAllUnpaid}
          pending={bulkPending}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <TableHead>Staff</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Dive Site</TableHead>
              <TableHead>Dives</TableHead>
              <TableHead>Divers</TableHead>
              <TableHead>Rate</TableHead>
              {ratioBonusEnabled ? (
                <>
                  <TableHead>Base Amount</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Total</TableHead>
                </>
              ) : (
                <TableHead>Amount</TableHead>
              )}
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={ratioBonusEnabled ? 12 : 10} className="text-center py-8 text-gray-400 text-sm">
                  No completed fun dives to calculate yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const overRatio = r.divers > 4;
                const baseAmount = r.dives * r.rate;
                return (
                  <tr key={r.key} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy whitespace-nowrap">{r.staffName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3">{r.site}</td>
                    <td className="px-4 py-3 text-right">{r.dives}</td>
                    <td className="px-4 py-3 text-right">
                      {r.divers}
                      {overRatio && ratioBonusEnabled && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-light text-orange">
                          &gt;4
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "paid" ? (
                        peso(r.rate)
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={r.rate}
                          onChange={(e) => setRate(r.key, parseFloat(e.target.value) || 0)}
                          className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                        />
                      )}
                    </td>
                    {ratioBonusEnabled ? (
                      <>
                        <td className="px-4 py-3 text-right">{peso(baseAmount)}</td>
                        <td className="px-4 py-3 text-right">
                          {!overRatio ? (
                            <span className="text-gray-400">—</span>
                          ) : r.status === "paid" ? (
                            peso(r.bonusAmount)
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={r.bonusAmount}
                              onChange={(e) => setBonus(r.key, parseFloat(e.target.value) || 0)}
                              className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-navy">{peso(r.amount)}</td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-right font-semibold text-navy">{peso(r.amount)}</td>
                    )}
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                      {r.justSaved && <div className="text-xs text-green mt-1">Saved.</div>}
                      {errorKey === r.key && <div className="text-xs text-red mt-1">Could not save.</div>}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "paid" ? (
                        <span className="text-gray-400 text-xs">Paid</span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveRow(r, false)}
                            disabled={pending && pendingKey === r.key}
                            className="px-2.5 py-1 text-xs font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => saveRow(r, true)}
                            disabled={pending && pendingKey === r.key}
                            className="px-2.5 py-1 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-60"
                          >
                            Mark as Paid
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EducatorTable({
  rows,
  setRows,
}: {
  rows: EditableEducatorRow[];
  setRows: (updater: (prev: EditableEducatorRow[]) => EditableEducatorRow[]) => void;
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [pending, startTransition] = useTransition();

  function setAmount(key: string, amount: number) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount, justSaved: false } : r)));
  }

  function saveRow(row: EditableEducatorRow, markPaid: boolean) {
    setPendingKey(row.key);
    setErrorKey(null);
    startTransition(async () => {
      const res = await saveInstructorCommission(row.date, row.staffName, row.course, row.students, row.amount, markPaid);
      if (res.error) {
        setErrorKey(row.key);
      } else {
        setRows((prev) =>
          prev.map((r) => (r.key === row.key ? { ...r, status: res.status!, amount: res.amount!, justSaved: !markPaid } : r)),
        );
      }
      setPendingKey(null);
    });
  }

  async function markAllUnpaid() {
    setBulkPending(true);
    const unpaid = rows.filter((r) => r.status === "unpaid");
    await Promise.all(
      unpaid.map(async (row) => {
        const res = await saveInstructorCommission(row.date, row.staffName, row.course, row.students, row.amount, true);
        if (!res.error) {
          setRows((prev) =>
            prev.map((r) => (r.key === row.key ? { ...r, status: res.status!, amount: res.amount!, justSaved: false } : r)),
          );
        }
      }),
    );
    setBulkPending(false);
  }

  return (
    <div>
      <div className="px-5 py-3 flex justify-end">
        <BulkMarkPaidButton
          unpaidCount={rows.filter((r) => r.status === "unpaid").length}
          onClick={markAllUnpaid}
          pending={bulkPending}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <TableHead>Staff</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                  No course counts to calculate yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy whitespace-nowrap">{r.staffName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3">{r.course}</td>
                  <td className="px-4 py-3 text-right">{r.students}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "paid" ? (
                      peso(r.amount)
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={r.amount}
                        onChange={(e) => setAmount(r.key, parseFloat(e.target.value) || 0)}
                        className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                    {r.justSaved && <div className="text-xs text-green mt-1">Saved.</div>}
                    {errorKey === r.key && <div className="text-xs text-red mt-1">Could not save.</div>}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "paid" ? (
                      <span className="text-gray-400 text-xs">Paid</span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveRow(r, false)}
                          disabled={pending && pendingKey === r.key}
                          className="px-2.5 py-1 text-xs font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
                        >
                          Save Amount
                        </button>
                        <button
                          onClick={() => saveRow(r, true)}
                          disabled={pending && pendingKey === r.key}
                          className="px-2.5 py-1 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-60"
                        >
                          Mark as Paid
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Parent remounts this component (via a `key` tied to the applied date
// range) whenever `data` is reloaded, so plain useState initializers are
// enough — no effect needed to re-sync local state with a new `data` prop.
export function StaffTab({ data }: { data: StaffActivityData }) {
  const [leaderRows, setLeaderRows] = useState<EditableLeaderRow[]>(() => withEditable(data.leaderRows));
  const [educatorRows, setEducatorRows] = useState<EditableEducatorRow[]>(() => withEditable(data.educatorRows));

  return (
    <div className="grid gap-5">
      <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
        Staff Activity Summary is a reference for commissions. AquaDesk counts the work — you set the rates and
        mark commission rows as paid. Only the rows shown for the selected date range are affected by &quot;Mark
        All Unpaid as Paid.&quot;
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">Leading Our Dives</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Dives × rate = base pay, automatically.
            {data.ratioBonusEnabled && " Groups over 4 divers get a manual bonus option — never a formula."}
          </div>
        </div>
        <LeaderTable rows={leaderRows} setRows={setLeaderRows} ratioBonusEnabled={data.ratioBonusEnabled} />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">Our Dive Educators</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Students and course are tallied automatically — the payout amount is always entered by hand.
          </div>
        </div>
        <EducatorTable rows={educatorRows} setRows={setEducatorRows} />
      </div>
    </div>
  );
}
