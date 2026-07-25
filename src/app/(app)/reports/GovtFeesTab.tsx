"use client";

import { useState, useTransition } from "react";
import { getGovtFeesData, saveGovtFeeRows, deleteGovtFeeRecord } from "./actions";
import type { GovtFeeRecord, GovtFeesData, GovtFeeType } from "./data";

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const FEE_TYPES: GovtFeeType[] = ["Marine Fee", "Shark Fee", "Other Fee"];

type DraftRow = {
  localId: number;
  date: string;
  feeType: GovtFeeType;
  rate: string;
  divers: string;
};

let nextLocalId = 1;

function emptyDraftRow(): DraftRow {
  return { localId: nextLocalId++, date: todayManila(), feeType: "Marine Fee", rate: "0", divers: "0" };
}

export function GovtFeesTab({
  data,
  appliedFrom,
  appliedTo,
}: {
  data: GovtFeesData;
  appliedFrom: string;
  appliedTo: string;
}) {
  const [records, setRecords] = useState<GovtFeeRecord[]>(data.records);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addRow() {
    setMessage(null);
    setDraftRows((rows) => [...rows, emptyDraftRow()]);
  }

  function updateDraft(localId: number, patch: Partial<DraftRow>) {
    setDraftRows((rows) => rows.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  function removeDraft(localId: number) {
    setDraftRows((rows) => rows.filter((r) => r.localId !== localId));
  }

  function saveAll() {
    if (draftRows.length === 0) {
      setMessage("No new rows to save.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await saveGovtFeeRows(
        draftRows.map((r) => ({
          date: r.date,
          feeType: r.feeType,
          rate: parseFloat(r.rate) || 0,
          divers: parseInt(r.divers, 10) || 0,
        })),
      );
      if (res.error) {
        setMessage(res.error);
      } else {
        setDraftRows([]);
        const fresh = await getGovtFeesData(appliedFrom, appliedTo);
        setRecords(fresh.records);
        setMessage("Government fees saved.");
      }
    });
  }

  function removeRecord(r: GovtFeeRecord) {
    setMessage(null);
    setRowPending(r.id);
    startTransition(async () => {
      await deleteGovtFeeRecord(r.id);
      const fresh = await getGovtFeesData(appliedFrom, appliedTo);
      setRecords(fresh.records);
      setRowPending(null);
    });
  }

  const draftTotal = draftRows.reduce((s, r) => s + (parseFloat(r.rate) || 0) * (parseInt(r.divers, 10) || 0), 0);
  const savedTotal = records.reduce((s, r) => s + r.total, 0);
  const grandTotal = savedTotal + draftTotal;

  return (
    <div className="grid gap-5">
      <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
        Log the government fees your dive center owes for the selected period — separate from what divers are
        charged.
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-extrabold text-navy">Government Fees</div>
            <div className="text-xs text-gray-500 mt-0.5">Fees owed to local government per diver activity.</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addRow}
              className="px-3 py-1.5 text-xs font-medium bg-teal text-white rounded-md hover:bg-teal-mid"
            >
              + Add Row
            </button>
            <button
              onClick={saveAll}
              disabled={pending}
              className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save All"}
            </button>
          </div>
        </div>

        {message && <div className="px-5 py-3 text-sm text-gray-600">{message}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 w-40">Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Fee Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right w-32">
                  Rate (₱)
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right w-36">
                  No. of Divers
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right w-32">
                  Total
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 w-16">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && draftRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                    No government fees recorded for the selected date range.
                  </td>
                </tr>
              ) : (
                <>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 font-semibold text-navy">{r.feeType}</td>
                      <td className="px-4 py-3 text-right">{peso(r.rate)}</td>
                      <td className="px-4 py-3 text-right">{r.divers}</td>
                      <td className="px-4 py-3 text-right font-semibold text-navy">{peso(r.total)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeRecord(r)}
                          disabled={pending && rowPending === r.id}
                          className="text-xs text-red hover:underline disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {draftRows.map((r) => (
                    <tr key={r.localId} className="border-b border-gray-100 last:border-0 bg-off-white">
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => updateDraft(r.localId, { date: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={r.feeType}
                          onChange={(e) => updateDraft(r.localId, { feeType: e.target.value as GovtFeeType })}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        >
                          {FEE_TYPES.map((ft) => (
                            <option key={ft} value={ft}>
                              {ft}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={r.rate}
                          onChange={(e) => updateDraft(r.localId, { rate: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={r.divers}
                          onChange={(e) => updateDraft(r.localId, { divers: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-navy">
                        {peso((parseFloat(r.rate) || 0) * (parseInt(r.divers, 10) || 0))}
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeDraft(r.localId)} className="text-xs text-red hover:underline">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
            {(records.length > 0 || draftRows.length > 0) && (
              <tfoot>
                <tr className="bg-navy text-white font-extrabold">
                  <td className="px-4 py-3" colSpan={4}>
                    Grand Total
                  </td>
                  <td className="px-4 py-3 text-right">{peso(grandTotal)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
