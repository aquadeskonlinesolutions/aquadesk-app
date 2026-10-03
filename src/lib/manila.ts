// Shared Asia/Manila date helpers. AquaDesk has no per-dive-center timezone
// setting, so every "which day is it" decision and every date/time display
// uses Manila (UTC+8, no daylight saving) — never the device's or the
// server's own timezone. Stored timestamps stay UTC (timestamptz).
import { manilaTodayStr } from "./age";

export { manilaTodayStr };

export const MANILA_TZ = "Asia/Manila";

// A plain "YYYY-MM-DD" plus n calendar days, computed on the date itself —
// no device or server timezone involved.
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// The current Manila calendar month as an inclusive date range.
export function manilaMonthRange(): { from: string; to: string } {
  const [y, m] = manilaTodayStr().split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(lastDay).padStart(2, "0")}` };
}
