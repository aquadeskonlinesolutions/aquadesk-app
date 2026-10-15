// How many dives one activity row stands for, read from its dive-site text
// (one comma-separated entry per dive: "Gato, Gato, Gato" = 3, "Local, Local" = 2,
// "Lighthouse" = 1). Mirrors public.activity_dive_count() (migration 058) — no
// dive count is stored anywhere else. Returns null when the text can't be
// counted reliably (empty, or an entry containing a digit or "+", such as
// "3sharks+3gato"): the caller must say so, never guess.
export function diveCountFromSite(site: string | null | undefined): number | null {
  const entries = String(site ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;
  if (entries.some((e) => /[0-9+]/.test(e))) return null;
  return entries.length;
}
