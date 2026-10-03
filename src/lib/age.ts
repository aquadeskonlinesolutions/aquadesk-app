// Birthday/age helpers shared by the diver form (client) and its server
// action. Age is always calculated from divers.birthday — "today" is the
// Asia/Manila calendar date, same +8h-shift trick used across the app.
// Birthdays are plain "YYYY-MM-DD" date strings, compared field by field,
// so no timezone conversion ever touches them.

export function manilaTodayStr(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split("-").map(Number);
  return [y, m, d];
}

// Whole years completed on `todayStr`. A Feb 29 birthday counts as reached
// on Mar 1 in non-leap years (Feb 28 still compares as "not yet").
export function ageOn(birthday: string, todayStr: string = manilaTodayStr()): number {
  const [by, bm, bd] = parts(birthday);
  const [ty, tm, td] = parts(todayStr);
  const notYet = tm < bm || (tm === bm && td < bd);
  return ty - by - (notYet ? 1 : 0);
}

export const MAX_AGE_YEARS = 120;

// Returns an error message, or null when valid. "" means "clear the
// birthday" and is valid. Must be a real calendar date, not in the
// future, and no more than MAX_AGE_YEARS years ago.
export function birthdayError(value: string, todayStr: string = manilaTodayStr()): string | null {
  if (value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid birthday.";
  const [y, m, d] = parts(value);
  // setUTCFullYear avoids Date.UTC mapping years 0-99 onto 1900-1999.
  const check = new Date(Date.UTC(2000, m - 1, d));
  check.setUTCFullYear(y);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return "Enter a valid birthday.";
  }
  if (value > todayStr) return "Birthday can't be in the future.";
  const [ty] = parts(todayStr);
  const earliest = `${String(ty - MAX_AGE_YEARS).padStart(4, "0")}${todayStr.slice(4)}`;
  if (value < earliest) return `Birthday can't be more than ${MAX_AGE_YEARS} years ago.`;
  return null;
}
