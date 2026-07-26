export const POSITION_LABELS: Record<string, string> = {
  secretary: "Secretary",
  divemaster: "Divemaster",
  instructor: "Instructor",
  crew: "Crew",
};

export const POSITION_OPTIONS = Object.entries(POSITION_LABELS);

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  freelance: "Freelance",
};

export const EMPLOYMENT_STATUS_OPTIONS = Object.entries(EMPLOYMENT_STATUS_LABELS);

// Same list as divers/[id]/constants.ts and the old staff/constants.ts —
// deliberately duplicated, not shared, matching this codebase's established
// small-helper duplication precedent.
export const RELATIONSHIP_OPTIONS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];
