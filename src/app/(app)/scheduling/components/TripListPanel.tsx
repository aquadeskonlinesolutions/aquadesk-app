"use client";

import type { TripSummary } from "../data";

function fmtTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${ampm}`;
}

export function TripListPanel({
  trips,
  pending,
  selectedId,
  onSelect,
}: {
  trips: TripSummary[];
  pending: boolean;
  selectedId: string | "new" | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-navy">
        Trips
      </div>
      {pending ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No trips for this date.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {trips.map((t) => (
            <button
              key={t.scheduleId}
              onClick={() => onSelect(t.scheduleId)}
              className={`w-full text-left px-4 py-3 hover:bg-off-white transition-colors ${
                selectedId === t.scheduleId ? "bg-off-white" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-navy text-sm">
                  {t.boatName ?? t.joinerBoatName ?? "Boat TBD"} — {fmtTime(t.departureTime)}
                </div>
                <div className="flex gap-1.5">
                  {t.cancelled && (
                    <span className="text-xs bg-red/10 text-red px-1.5 py-0.5 rounded">Cancelled</span>
                  )}
                  {t.closed && (
                    <span className="text-xs bg-teal/10 text-teal px-1.5 py-0.5 rounded">Closed</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {t.siteNames.length ? t.siteNames.join(", ") : "No sites"} · {t.diverCount} diver
                {t.diverCount === 1 ? "" : "s"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
