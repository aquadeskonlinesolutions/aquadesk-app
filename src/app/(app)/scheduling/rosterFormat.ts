// Rewritten (not ported literally) from the old app's scheduling.html —
// nationalityAdjective(), diverCertShort(), and diverExperienceLine() — for
// this codebase's TypeScript conventions. Same underlying mapping data as
// the original, since that's the actual business rule (nationality→adjective,
// certification abbreviation) being carried forward, not the old app's code.

const NATIONALITY_ADJECTIVES: Record<string, string> = {
  philippines: "Filipino",
  filipino: "Filipino",
  germany: "German",
  german: "German",
  korea: "Korean",
  "south korea": "Korean",
  "republic of korea": "Korean",
  korean: "Korean",
  "united states": "American",
  usa: "American",
  "united states of america": "American",
  american: "American",
  "united kingdom": "British",
  britain: "British",
  england: "British",
  british: "British",
  france: "French",
  french: "French",
  spain: "Spanish",
  spanish: "Spanish",
  italy: "Italian",
  italian: "Italian",
  netherlands: "Dutch",
  dutch: "Dutch",
  australia: "Australian",
  australian: "Australian",
  canada: "Canadian",
  canadian: "Canadian",
  japan: "Japanese",
  japanese: "Japanese",
  china: "Chinese",
  chinese: "Chinese",
  taiwan: "Taiwanese",
  taiwanese: "Taiwanese",
  switzerland: "Swiss",
  swiss: "Swiss",
  sweden: "Swedish",
  swedish: "Swedish",
  norway: "Norwegian",
  norwegian: "Norwegian",
  denmark: "Danish",
  danish: "Danish",
  india: "Indian",
  indian: "Indian",
  russia: "Russian",
  russian: "Russian",
};

export function nationalityAdjective(raw: string | null): string {
  const v = String(raw ?? "").trim();
  if (!v) return "Nationality not set";
  return NATIONALITY_ADJECTIVES[v.toLowerCase()] ?? v;
}

const CERT_LEVEL_SHORT: Record<string, string> = {
  none: "None",
  open_water_diver: "OW",
  advanced_open_water: "AOW",
  rescue_diver: "Rescue",
  divemaster: "DM",
  instructor: "Instructor",
};

export function certLevelShort(level: string): string {
  return CERT_LEVEL_SHORT[level] ?? level;
}

export function diverExperienceLine(
  experienceType: "fun_diving" | "dive_course" | null,
  courseName: string | null,
): string {
  if (experienceType === "dive_course") return `Course - ${courseName ?? "Course"}`;
  return "Fun diving";
}
