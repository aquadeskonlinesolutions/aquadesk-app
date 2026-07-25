"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { ScheduleDiverRow, TripDetail, StaffOption } from "../data";
import { getScheduleDivers, getTripDetail, markBoatReturned } from "../actions";

export function ConfirmPanel({
  scheduleId,
  staffOptions,
  refreshKey,
  onReturned,
}: {
  scheduleId: string;
  staffOptions: StaffOption[];
  refreshKey: number;
  onReturned: () => void;
}) {
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [divers, setDivers] = useState<ScheduleDiverRow[]>([]);
  const [fuelLiters, setFuelLiters] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getTripDetail(scheduleId).then(setDetail);
    getScheduleDivers(scheduleId).then(setDivers);
  }, [scheduleId, refreshKey]);

  if (!detail) return null;

  const staffNameById = new Map(staffOptions.map((s) => [s.id, s.fullName]));
  const byStaff = new Map<string, ScheduleDiverRow[]>();
  for (const d of divers) {
    const key = d.staffId ?? "__unassigned__";
    if (!byStaff.has(key)) byStaff.set(key, []);
    byStaff.get(key)!.push(d);
  }
  const tally = {
    tank12L: divers.filter((d) => !d.is15L).length,
    tank15L: divers.filter((d) => d.is15L).length,
    nitrox: divers.filter((d) => d.nitroxRequested).length,
  };

  function returnBoat() {
    setError(null);
    setSkipped(null);
    startTransition(async () => {
      const res = await markBoatReturned(
        scheduleId,
        fuelLiters.trim() ? Number(fuelLiters) : null,
      );
      if (res.error) {
        setError(res.error);
      } else {
        if (res.skippedDivers && res.skippedDivers.length > 0) {
          setSkipped(res.skippedDivers);
        }
        onReturned();
      }
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="text-sm font-semibold text-navy">Confirm</div>
        <Link href="/staff" className="text-xs text-teal hover:underline">
          Get today&apos;s crew code →
        </Link>
      </div>

      <div className="p-4 grid gap-3">
        {error && <div className="text-sm text-red">{error}</div>}
        {skipped && (
          <div className="text-xs bg-amber-100 text-amber-700 px-3 py-2 rounded-md">
            No open visit found for: {skipped.join(", ")} — their activity rows were skipped.
            Start a visit for them manually, then re-run Boat Returned if needed.
          </div>
        )}

        <div className="flex gap-4 text-xs text-gray-500">
          <span>12L tanks: {tally.tank12L}</span>
          <span>15L tanks: {tally.tank15L}</span>
          <span>Nitrox: {tally.nitrox}</span>
        </div>

        {divers.length === 0 ? (
          <div className="text-sm text-gray-400">No divers assigned yet.</div>
        ) : (
          <div className="grid gap-2">
            {[...byStaff.entries()].map(([staffId, group]) => (
              <div key={staffId} className="border border-gray-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-navy mb-1">
                  {staffId === "__unassigned__" ? "Unassigned" : staffNameById.get(staffId) ?? "Staff"}
                </div>
                <div className="text-xs text-gray-600">
                  {group.map((d) => `${d.firstName} ${d.lastName}`).join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}

        {detail.closed ? (
          <div className="text-sm text-teal">This trip is closed — boat returned.</div>
        ) : detail.cancelled ? (
          <div className="text-sm text-gray-400">This trip is cancelled.</div>
        ) : (
          <div className="border-t border-gray-200 pt-3 flex items-end gap-3 flex-wrap">
            {!detail.isJoiner && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fuel Consumed (liters)
                </label>
                <input
                  type="number"
                  min={0}
                  value={fuelLiters}
                  onChange={(e) => setFuelLiters(e.target.value)}
                  className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-32"
                />
              </div>
            )}
            <button
              onClick={returnBoat}
              disabled={pending || divers.length === 0}
              className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
            >
              {pending ? "Closing…" : "Boat Returned"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
