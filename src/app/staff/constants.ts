// Duplicated from scheduling/constants.ts and the other per-page copies
// per this codebase's established small-helper-duplication precedent
// (client components need pure constants in their own file, not shared
// across page boundaries).
export const CERT_LEVEL_LABELS: Record<string, string> = {
  none: "None",
  open_water_diver: "Open Water Diver",
  advanced_open_water: "Advanced Open Water",
  rescue_diver: "Rescue Diver",
  divemaster: "Divemaster",
  instructor: "Instructor",
};

export const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  fun_diving: "Fun Diving",
  dive_course: "Dive Course",
};
