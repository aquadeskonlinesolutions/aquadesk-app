const BOAT_MODE_LABELS: Record<string, string> = {
  own_boat: "Own Boat",
  join_ride: "Join Ride",
  rental: "Rental",
};

export const BOAT_MODE_OPTIONS = Object.entries(BOAT_MODE_LABELS);

export const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  fun_diving: "Fun Diving",
  dive_course: "Dive Course",
};

export const EXPERIENCE_TYPE_OPTIONS = Object.entries(EXPERIENCE_TYPE_LABELS);

// Duplicated from divers/constants.ts and diver-form/[id]/constants.ts per this
// codebase's established small-helper-duplication precedent (client components
// need pure constants in their own file, not shared across page boundaries).
export const CERT_LEVEL_LABELS: Record<string, string> = {
  none: "None",
  open_water_diver: "Open Water Diver",
  advanced_open_water: "Advanced Open Water",
  rescue_diver: "Rescue Diver",
  divemaster: "Divemaster",
  instructor: "Instructor",
};

// Shared 1:4 staff:diver ratio badge threshold — matches scheduling.html's
// real count>6?'danger':(count>4?'warn':'') formula, used identically at
// clip creation (Phase 1), trip building (Phase 2's WarningsBanner), and
// the confirm screen (Phase 3) rather than duplicating the thresholds
// three times.
export function ratioBadgeClass(count: number): string {
  if (count > 6) return "bg-red/10 text-red";
  if (count > 4) return "bg-orange-light text-orange";
  return "bg-teal/10 text-teal";
}
