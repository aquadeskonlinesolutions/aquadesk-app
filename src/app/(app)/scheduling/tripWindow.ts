// Shared, pure trip-time-window math — ports scheduling.html's real
// tripWindow()/overlaps() (a genuine interval-overlap check, not a
// same-day-only one): total trip length = travelOut + travelBack +
// (dives × diveMinutes) + ((dives-1) × surfaceIntervalMinutes). The live
// app keys this off a hardcoded per-trip-type JS constant specific to one
// dive center's own geography ("Local Dive", "Gato", ...) — this rebuild
// recreates the same durations shape as a real per-dive-center Settings
// list (trip_types table) instead, so it generalizes across tenants.

export type TripTypeDurations = {
  travelOutMinutes: number;
  travelBackMinutes: number;
  diveMinutes: number;
  surfaceIntervalMinutes: number;
};

// Used only when a trip has a departure time but no trip type selected
// (e.g. a trip saved before this feature existed, or a dive center that
// hasn't configured trip types yet) — a reasonable generic guess so
// overlap detection still degrades usefully instead of going silent.
export const FALLBACK_DURATION: TripTypeDurations = {
  travelOutMinutes: 60,
  travelBackMinutes: 60,
  diveMinutes: 60,
  surfaceIntervalMinutes: 60,
};

export type TripWindow = { start: number; end: number };

export function computeTripWindow(
  departureTime: string | null, // "HH:MM" 24h, matches schedules.departure_time
  diveCount: number,
  durations: TripTypeDurations | null,
): TripWindow | null {
  if (!departureTime) return null;
  const [h, m] = departureTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const start = h * 60 + m;
  const d = durations ?? FALLBACK_DURATION;
  const dives = Math.max(diveCount, 1);
  const duration =
    d.travelOutMinutes + d.travelBackMinutes + dives * d.diveMinutes + Math.max(0, dives - 1) * d.surfaceIntervalMinutes;
  return { start, end: start + duration };
}

export function windowsOverlap(a: TripWindow, b: TripWindow): boolean {
  return a.start < b.end && b.start < a.end;
}
