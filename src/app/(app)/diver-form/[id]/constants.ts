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
