"use client";

import { useEffect } from "react";
import type { Activity } from "../data";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

// Course → Fun Diving: asks whether to keep or remove the bill's course fee
// rows. Only rows added in the new way (row type course_fee, migration 060)
// are ever listed or removed; older course rows are never touched. Same modal
// chrome as BillUnlockModal; Esc or a click outside cancels.
export function SwitchToFunModal({
  feeRows,
  olderCourseRowCount,
  pending,
  error,
  onClose,
  onChoose,
}: {
  feeRows: Activity[];
  olderCourseRowCount: number;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onChoose: (removeFees: boolean) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-xl text-navy">Switch to Fun Diving</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-6 grid gap-3">
          <p className="text-sm text-gray-600">
            This bill has {feeRows.length} course fee row{feeRows.length === 1 ? "" : "s"}. Keep{" "}
            {feeRows.length === 1 ? "it" : "them"} on the bill, or remove {feeRows.length === 1 ? "it" : "them"}?
            Fun dives on the bill are not touched either way.
          </p>
          <div className="grid gap-1.5">
            {feeRows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-navy truncate">{r.diveSite?.trim() || "(course not chosen yet)"}</div>
                  <div className="text-xs text-gray-500">
                    {r.date}
                    {r.staffName ? ` · ${r.staffName}` : ""}
                  </div>
                </div>
                <div className="font-semibold text-navy shrink-0">{peso(r.total)}</div>
              </div>
            ))}
          </div>
          {olderCourseRowCount > 0 && (
            <p className="text-xs text-gray-500">
              {olderCourseRowCount} older course row{olderCourseRowCount === 1 ? "" : "s"} on this bill (added before
              this feature) {olderCourseRowCount === 1 ? "is" : "are"} never removed by this.
            </p>
          )}
          {error && <div className="text-sm text-red">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end flex-wrap">
          <button onClick={onClose} disabled={pending} className="px-4 py-2 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={() => onChoose(false)}
            disabled={pending}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
          >
            {pending ? "Switching…" : "Keep course fee"}
          </button>
          <button
            onClick={() => onChoose(true)}
            disabled={pending}
            className="px-4 py-2 bg-red text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            Remove course fee
          </button>
        </div>
      </div>
    </div>
  );
}
