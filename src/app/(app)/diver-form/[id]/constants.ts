// Reverse of register/types.ts's CERT_LEVEL_TO_DB — that file maps the
// registration wizard's display labels to DB enum values; this page needs
// the other direction, to show an already-stored enum value as a label.
export const CERT_LEVEL_LABELS: Record<string, string> = {
  none: "None",
  open_water_diver: "Open Water Diver",
  advanced_open_water: "Advanced Open Water",
  rescue_diver: "Rescue Diver",
  divemaster: "Divemaster",
  instructor: "Instructor",
};

export const CERT_LEVEL_OPTIONS = Object.entries(CERT_LEVEL_LABELS);

export const RELATIONSHIP_OPTIONS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];

// Duplicated from pricing.ts's own copy (that file is server-only, so a
// client component can't import it directly) — pure string logic, no
// server dependency, matching this codebase's established small-helper
// duplication precedent. Order-independent so "Kimud, Monad, Kimud" and
// "Kimud, Kimud, Monad" resolve to the same package.
export function normalizeSiteKey(text: string): string {
  return text
    .split(/[,|+•;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}
