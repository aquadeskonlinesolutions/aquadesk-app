"use client";

import type { DayAssignment, StaffOption } from "../data";

type Assignment = {
  diverId: string;
  staffId: string | null;
  certificationLevel: string;
  nitroxRequested: boolean;
};

function ratioBadgeClass(count: number): string {
  if (count > 6) return "bg-red/10 text-red";
  if (count > 4) return "bg-orange-light text-orange";
  return "bg-teal/10 text-teal";
}

export function WarningsBanner({
  assignments,
  boatCapacity,
  dayContext,
  boatId,
  staffOptions,
}: {
  assignments: Assignment[];
  boatCapacity: number | null;
  dayContext: DayAssignment[];
  boatId: string | null;
  staffOptions: StaffOption[];
}) {
  const staffNameById = new Map(staffOptions.map((s) => [s.id, s.fullName]));
  const warnings: string[] = [];

  if (boatCapacity != null && assignments.length > boatCapacity) {
    warnings.push(
      `Diver count (${assignments.length}) exceeds this boat's capacity of ${boatCapacity}. You can still proceed, but check with the captain.`,
    );
  }

  // Same-day double-booking: diver, staff, or boat already appears on
  // another trip this date. Date-level only — schedules has no
  // trip-duration column, so this can't detect true time-range overlaps.
  const dayDiverIds = new Set(dayContext.map((d) => d.diverId));
  const dayStaffIds = new Set(dayContext.map((d) => d.staffId).filter(Boolean));
  const dayBoatIds = new Set(dayContext.map((d) => d.boatId).filter(Boolean));

  const doubleBookedDivers = assignments.filter((a) => dayDiverIds.has(a.diverId)).length;
  if (doubleBookedDivers > 0) {
    warnings.push(
      `${doubleBookedDivers} diver${doubleBookedDivers === 1 ? " is" : "s are"} also assigned to another trip today.`,
    );
  }
  const staffIdsHere = new Set(assignments.map((a) => a.staffId).filter(Boolean));
  const doubleBookedStaff = [...staffIdsHere].filter((id) => dayStaffIds.has(id));
  if (doubleBookedStaff.length > 0) {
    warnings.push(
      `${doubleBookedStaff.map((id) => staffNameById.get(id!) ?? "A staff member").join(", ")} also assigned to another trip today.`,
    );
  }
  if (boatId && dayBoatIds.has(boatId)) {
    warnings.push("This boat is also assigned to another trip today.");
  }

  // Ratio + mixed cert/nitrox per staff group within this trip.
  const byStaff = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const key = a.staffId ?? "__unassigned__";
    if (!byStaff.has(key)) byStaff.set(key, []);
    byStaff.get(key)!.push(a);
  }

  const staffBadges: { label: string; count: number }[] = [];
  const mixedWarnings: string[] = [];
  for (const [staffId, group] of byStaff) {
    if (staffId === "__unassigned__") continue;
    const label = staffNameById.get(staffId) ?? "Staff";
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
