// Mirrors divers.html's isVisible()/groupIsVisible() exactly (not just the
// "arrival minus one day through departure" shorthand) — see the group/
// individual "active window" write-up for the full derivation. Pure,
// framework-free so it works identically on the server (data.ts) or client.

export function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Shifts a plain Y-M-D date string by `days` using UTC-anchored Date math
// (never local time) so this never crosses a timezone boundary and loses a
// day — same category of bug covered by this project's other date-string
// arithmetic helpers.
function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isDiverActive(diver: {
  arrivalDate: string | null;
  departureDate: string | null;
  hasOpenVisit: boolean;
  billFullyClosed: boolean;
}): boolean {
  const today = todayManila();

  if (!diver.arrivalDate) return diver.hasOpenVisit;

  const arrivesFrom = shiftDateStr(diver.arrivalDate, -1);
  if (today < arrivesFrom) return false;

  if (!diver.departureDate || diver.departureDate >= today) return true;

  return !diver.billFullyClosed;
}

// Group-context visibility is genuinely different from isDiverActive above
// — no arrival-date gate at all. A group folder needs to be reachable
// (Copy Link, registration-progress tracking) well before arrival, so a
// member only drops out of "still active in this group" once their
// departure has passed AND their bill is fully closed — matches
// divers.html's isVisibleInGroup() exactly, not isVisible()/isDiverActive().
export function isDiverActiveInGroup(diver: { departureDate: string | null; billFullyClosed: boolean }): boolean {
  const today = todayManila();
  if (!diver.departureDate || diver.departureDate >= today) return true;
  return !diver.billFullyClosed;
}

// A group folder is visible from the moment it's created (matches
// divers.html's groupIsVisible()) and stays visible as long as it has no
// members yet, or at least one member is still active-in-group. It
// disappears only once every member has both departed and been fully billed.
export function isGroupActive(members: { departureDate: string | null; billFullyClosed: boolean }[]): boolean {
  if (members.length === 0) return true;
  return members.some(isDiverActiveInGroup);
}
