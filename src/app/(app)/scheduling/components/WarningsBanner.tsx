"use client";

import type { DayAssignment, StaffOption } from "../data";
import { ratioBadgeClass } from "../constants";
import { computeTripWindow, windowsOverlap, type TripTypeDurations } from "../tripWindow";

type Assignment = {
  diverId: string;
  staffId: string | null;
  staffName: string;
  certificationLevel: string;
  nitroxRequested: boolean;
};

export function WarningsBanner({
  assignments,
  boatCapacity,
  dayContext,
  boatId,
  staffOptions,
  departureTime,
  diveCount,
  tripTypeDurations,
}: {
  assignments: Assignment[];
  boatCapacity: number | null;
  dayContext: DayAssignment[];
  boatId: string | null;
  staffOptions: StaffOption[];
  departureTime: string | null;
  diveCount: number;
  tripTypeDurations: TripTypeDurations | null;
}) {
  const staffNameById = new Map(staffOptions.map((s) => [s.id, s.fullName]));
  const warnings: string[] = [];

  if (boatCapacity != null && assignments.length > boatCapacity) {
    warnings.push(
      `Diver count (${assignments.length}) exceeds this boat's capacity of ${boatCapacity}. You can still proceed, but check with the captain.`,
    );
  }

  // Real time-window overlap check (ports scheduling.html's tripWindow()/
  // overlaps()) — a diver/staff/boat only counts as double-booked when
  // this trip's window and the other trip's window genuinely overlap, not
  // just because both are on the same date. Falls back to the old
  // always-flag behavior when either side lacks enough data (no departure
  // time) to compute a real window at all.
  const myWindow = computeTripWindow(departureTime, diveCount, tripTypeDurations);
  function conflictsWithMine(other: DayAssignment): boolean {
    if (!myWindow) return true;
    const theirWindow = computeTripWindow(other.departureTime, other.diveCount, other.tripTypeDurations);
    if (!theirWindow) return true;
    return windowsOverlap(myWindow, theirWindow);
  }

  const conflicting = dayContext.filter(conflictsWithMine);
  const dayDiverIds = new Set(conflicting.map((d) => d.diverId));
  const dayStaffIds = new Set(conflicting.map((d) => d.staffId).filter(Boolean));
  const dayBoatIds = new Set(conflicting.map((d) => d.boatId).filter(Boolean));
  const overlapSuffix = myWindow ? "at an overlapping time" : "today";

  const doubleBookedDivers = assignments.filter((a) => dayDiverIds.has(a.diverId)).length;
  if (doubleBookedDivers > 0) {
    warnings.push(
      `${doubleBookedDivers} diver${doubleBookedDivers === 1 ? " is" : "s are"} also assigned to another trip ${overlapSuffix}.`,
    );
  }
  const staffIdsHere = new Set(assignments.map((a) => a.staffId).filter(Boolean));
  const doubleBookedStaff = [...staffIdsHere].filter((id) => dayStaffIds.has(id));
  if (doubleBookedStaff.length > 0) {
    warnings.push(
      `${doubleBookedStaff.map((id) => staffNameById.get(id!) ?? "A staff member").join(", ")} also assigned to another trip ${overlapSuffix}.`,
    );
  }
  if (boatId && dayBoatIds.has(boatId)) {
    warnings.push(`This boat is also assigned to another trip ${overlapSuffix}.`);
  }

  // Ratio + mixed cert/nitrox per staff group within this trip — grouped by
  // staffId when there is one, or by the freelancer's own name otherwise
  // (a freelancer has no staff_id, but still leads a real team that should
  // get the exact same ratio badge and mixed-cert/mixed-air checks as a
  // named staff member's group; this used to skip freelancer groups
  // entirely).
  const byStaff = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const key = a.staffId ?? a.staffName;
    if (!byStaff.has(key)) byStaff.set(key, []);
    byStaff.get(key)!.push(a);
  }

  const staffBadges: { label: string; count: number }[] = [];
  const mixedWarnings: string[] = [];
  for (const [key, group] of byStaff) {
    const label = staffNameById.get(key) ?? group[0]?.staffName ?? "Staff";
    staffBadges.push({ label, count: group.length });
    const certs = new Set(group.map((g) => g.certificationLevel));
    const nitroxMix = new Set(group.map((g) => g.nitroxRequested));
    if (certs.size > 1) mixedWarnings.push(`${label}'s group has mixed certification levels.`);
    if (nitroxMix.size > 1) mixedWarnings.push(`${label}'s group has a mix of Nitrox and Air.`);
  }

  if (warnings.length === 0 && staffBadges.length === 0 && mixedWarnings.length === 0) return null;

  return (
    <div className="grid gap-2">
      {staffBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {staffBadges.map((b) => (
            <span
              key={b.label}
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${ratioBadgeClass(b.count)}`}
            >
              {b.label}: {b.count}/4
            </span>
          ))}
        </div>
      )}
      {[...warnings, ...mixedWarnings].map((w, i) => (
        <div key={i} className="text-xs bg-orange-light text-orange border border-orange/20 px-3 py-2 rounded-md">
          ⚠️ {w}
        </div>
      ))}
    </div>
  );
}
