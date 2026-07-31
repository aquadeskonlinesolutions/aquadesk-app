"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { TripSummary, TripDetail, ScheduleDiverRow, StaffDiveTanks, StaffOption, BoatOption, DiveSiteOption, DiveTank } from "../data";
import {
  getTripDetail,
  getScheduleDivers,
  getStaffDiveTanks,
  markBoatReturned,
  getCrewTokenToday,
  generateCrewToken,
} from "../actions";
import { computeTankTally, formatTankLine } from "../tanks";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

// Manila-anchored "now", evaluated client-side — same Intl.DateTimeFormat
// en-CA pattern as scheduling/actions.ts's server-side nowManilaMinute(),
// so the client-side gate below agrees with markBoatReturned's own check.
function nowManilaMinute(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h24 = parseInt(hStr, 10);
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mStr} ${ampm}`;
}

// "Nitrox D1,D2" / "15L D1" — which dives (1-based) use which tank, for a
// diver whose choice can vary per dive on a multi-site trip.
function diverTankLabel(tanks: DiveTank[], siteCount: number): string {
  const nitroxSites: number[] = [];
  const air15Sites: number[] = [];
  for (let si = 0; si < siteCount; si++) {
    const match = tanks.find((t) => t.siteIndex === si);
    if (match?.tankType === "nitrox") nitroxSites.push(si + 1);
    else if (match?.tankType === "air_15l") air15Sites.push(si + 1);
  }
  const parts: string[] = [];
  if (nitroxSites.length > 0) parts.push(`Nitrox D${nitroxSites.join(",")}`);
  if (air15Sites.length > 0) parts.push(`15L D${air15Sites.join(",")}`);
  return parts.join(", ");
}

function diverLine(d: ScheduleDiverRow, siteCount: number): string {
  const name = `${d.firstName} ${d.lastName}`;
  if (d.experienceType === "dive_course") {
    return `  - ${name} - Course${d.courseName ? ` - ${d.courseName}` : ""}`;
  }
  const tankLabel = diverTankLabel(d.tanks, siteCount);
  return `  - ${name}${tankLabel ? ` - ${tankLabel}` : ""}`;
}

function groupByStaff(divers: ScheduleDiverRow[]): Map<string, ScheduleDiverRow[]> {
  const byStaff = new Map<string, ScheduleDiverRow[]>();
  divers.forEach((d) => {
    const key = d.staffId ?? "__unassigned__";
    if (!byStaff.has(key)) byStaff.set(key, []);
    byStaff.get(key)!.push(d);
  });
  return byStaff;
}

function resolveStaffName(staffId: string, staffNameById: Map<string, string>): string {
  return staffId === "__unassigned__" ? "Unassigned" : (staffNameById.get(staffId) ?? "Staff");
}

// Matches scheduling.html's real buildPreview()/tripImageRows() section
// order: boat/date/time/captain, the dive-site line, a blank line, each
// staff group's divers (course divers show their course, fun divers show
// per-dive tank detail), the tank tally last, then join-ride/notes.
function tripPreviewText(
  detail: TripDetail,
  boat: BoatOption | null,
  diveSites: DiveSiteOption[],
  divers: ScheduleDiverRow[],
  staffTanks: StaffDiveTanks[],
  staffNameById: Map<string, string>,
): string {
  const byStaff = groupByStaff(divers);
  const siteCount = detail.siteIds.length;
  const siteNameById = new Map(diveSites.map((s) => [s.id, s.siteName]));
  const staffTanksByName = new Map(staffTanks.map((s) => [s.staffName, s.siteIndexes]));

  const lines: string[] = [];
  lines.push(detail.isJoiner ? (detail.joinerBoatName ?? "Join Ride") : (boat?.name ?? "Boat"));
  lines.push(`Date: ${detail.scheduleDate}`);
  if (detail.departureTime) lines.push(`Departure: ${detail.departureTime}`);
  if (!detail.isJoiner) {
    lines.push(`Captain: ${detail.captain || "-"}`);
    lines.push(`Crew: ${detail.crew.length ? detail.crew.join(", ") : "-"}`);
  }
  if (siteCount > 0) {
    lines.push(detail.siteIds.map((id, i) => `Dive ${i + 1} - ${siteNameById.get(id) ?? "Site"}`).join(" | "));
  }
  lines.push("");

  const staffNitroxByTeam: number[][] = [];
  if (byStaff.size === 0) {
    lines.push("No divers assigned.");
  } else {
    for (const [staffId, group] of byStaff) {
      const staffName = resolveStaffName(staffId, staffNameById);
      lines.push(`${staffName}:`);
      if (group.length === 0) lines.push("  - No divers assigned");
      else group.forEach((d) => lines.push(diverLine(d, siteCount)));
      staffNitroxByTeam.push(staffTanksByName.get(staffName) ?? []);
      lines.push("");
    }
  }

  const tally = computeTankTally({
    siteCount,
    diverTanks: divers.map((d) => d.tanks),
    staffNitroxSiteIndexesByTeam: staffNitroxByTeam,
    spareTanks: detail.spareTanks.map((t) => ({ type: t.tankType, quantity: t.quantity })),
  });
  lines.push(`Tank Tally: ${formatTankLine(tally)}`);

  if (detail.guestDiversCount) {
    lines.push(
      `Joining us: ${detail.guestDiversCount} diver(s) from ${detail.guestDiveCenterName ?? "another dive center"}`,
    );
  }
  if (detail.notes) lines.push(`Notes: ${detail.notes}`);

  return lines.join("\n");
}

function downloadTripImage(text: string, fileName: string) {
  const lines = text.split("\n");
  const lineHeight = 22;
  const padding = 20;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = lines.length * lineHeight + padding * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a2b4a";
  ctx.font = "14px sans-serif";
  lines.forEach((line, i) => {
    if (i === 0) ctx.font = "bold 16px sans-serif";
    else ctx.font = "14px sans-serif";
    ctx.fillText(line, padding, padding + (i + 1) * lineHeight - 6);
  });
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function TripSummaryCard({
  scheduleId,
  boats,
  diveSites,
  staffOptions,
  onReturned,
}: {
  scheduleId: string;
  boats: BoatOption[];
  diveSites: DiveSiteOption[];
  staffOptions: StaffOption[];
  onReturned: () => void;
}) {
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [divers, setDivers] = useState<ScheduleDiverRow[]>([]);
  const [staffTanks, setStaffTanks] = useState<StaffDiveTanks[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[] | null>(null);
  const [duplicates, setDuplicates] = useState<{ diverId: string; name: string }[] | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    getTripDetail(scheduleId).then(setDetail);
    getScheduleDivers(scheduleId).then(setDivers);
    getStaffDiveTanks(scheduleId).then(setStaffTanks);
  }

  useEffect(refresh, [scheduleId]);

  if (!detail) return null;
  const boat = detail.boatId ? (boats.find((b) => b.id === detail.boatId) ?? null) : null;
  const staffNameById = new Map(staffOptions.map((s) => [s.id, s.fullName]));

  const byStaff = groupByStaff(divers);
  const siteCount = detail.siteIds.length;
  const staffTanksByName = new Map(staffTanks.map((s) => [s.staffName, s.siteIndexes]));
  const staffNitroxByTeam = [...byStaff.keys()].map(
    (staffId) => staffTanksByName.get(resolveStaffName(staffId, staffNameById)) ?? [],
  );
  const tally = computeTankTally({
    siteCount,
    diverTanks: divers.map((d) => d.tanks),
    staffNitroxSiteIndexesByTeam: staffNitroxByTeam,
    spareTanks: detail.spareTanks.map((t) => ({ type: t.tankType, quantity: t.quantity })),
  });

  function returnBoat(options: { excludeDiverIds?: string[]; forceProceed?: boolean } = {}) {
    setError(null);
    setSkipped(null);
    startTransition(async () => {
      const res = await markBoatReturned(scheduleId, options);
      if (res.error) {
        setError(res.error);
      } else if (res.duplicates && res.duplicates.length > 0) {
        setDuplicates(res.duplicates);
      } else {
        setDuplicates(null);
        if (res.skippedDivers && res.skippedDivers.length > 0) setSkipped(res.skippedDivers);
        onReturned();
        refresh();
      }
    });
  }

  const siteNameById = new Map(diveSites.map((s) => [s.id, s.siteName]));
  const canReturn = !detail.departureTime || nowManilaMinute() >= `${detail.scheduleDate}T${detail.departureTime.slice(0, 5)}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-navy text-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-extrabold text-sm">
            {detail.isJoiner ? (detail.joinerBoatName ?? "Join Ride") : (boat?.name ?? "Boat")}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {detail.closed && (
              <span className="text-xs bg-teal/30 text-white px-2 py-0.5 rounded-full">Returned</span>
            )}
            {detail.cancelled && (
              <span className="text-xs bg-red/30 text-white px-2 py-0.5 rounded-full">Cancelled</span>
            )}
            <button
              onClick={() =>
                downloadTripImage(
                  tripPreviewText(detail, boat, diveSites, divers, staffTanks, staffNameById),
                  `${detail.scheduleDate} - ${boat?.name ?? detail.joinerBoatName ?? "trip"} - ${detail.departureTime ?? ""}.png`,
                )
              }
              className="text-xs font-medium text-white/80 border border-white/30 rounded-md px-2 py-1 hover:bg-white/10"
            >
              Download Image
            </button>
          </div>
        </div>
        {/* Meta row — matches scheduling.html's confirmTripHTML() real
            .confirm-meta block, visible on screen, not just in the
            clipboard "Copy Preview"/Download Image text. */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/70 mt-1.5">
          <span>Date: {detail.scheduleDate}</span>
          <span>Departure: {detail.departureTime || "No time"}</span>
          {!detail.isJoiner && <span>Captain: {detail.captain || "-"}</span>}
          {!detail.isJoiner && <span>Crew: {detail.crew.length ? detail.crew.join(", ") : "-"}</span>}
          {!detail.isJoiner && detail.fuelConsumedLiters != null && (
            <span>Fuel: {detail.fuelConsumedLiters} L</span>
          )}
          <span>
            {divers.length} diver{divers.length === 1 ? "" : "s"}
          </span>
        </div>
        {/* Site chips — matches scheduling.html's real .site-chips row,
            also never shown on screen before this. */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {detail.siteIds.length > 0 ? (
            detail.siteIds.map((id, i) => (
              <span
                key={`${id}-${i}`}
                className="text-[10px] font-semibold bg-white/10 border border-white/20 text-white px-2 py-0.5 rounded-full"
              >
                Dive {i + 1} - {siteNameById.get(id) ?? "Site"}
              </span>
            ))
          ) : (
            <span className="text-[10px] font-semibold bg-white/10 border border-white/20 text-white px-2 py-0.5 rounded-full">
              No dives
            </span>
          )}
        </div>
      </div>

      <div className="p-4 grid gap-3">
        {error && <div className="text-sm text-red">{error}</div>}
        {skipped && (
          <div className="text-xs bg-orange-light text-orange border border-orange/20 px-3 py-2 rounded-md">
            No open visit found for: {skipped.join(", ")} — their activity rows were skipped.
          </div>
        )}
        {duplicates && (
          <div className="text-xs bg-orange-light text-orange border border-orange/20 px-3 py-2 rounded-md grid gap-2">
            <div>
              Activities already logged today for: {duplicates.map((d) => d.name).join(", ")}. Log again anyway, or
              exclude them from this return?
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => returnBoat({ excludeDiverIds: duplicates.map((d) => d.diverId) })}>
                Exclude Divers
              </Button>
              <Button variant="ghost" size="sm" onClick={() => returnBoat({ forceProceed: true })}>
                Proceed Anyway
              </Button>
              <button onClick={() => setDuplicates(null)} className="px-2 py-1 text-gray-500 text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        {divers.length === 0 ? (
          <div className="text-sm text-gray-400">No divers assigned.</div>
        ) : (
          <div className="grid gap-2">
            {[...byStaff.entries()].map(([staffId, group]) => (
              <div key={staffId} className="border border-gray-100 rounded-lg p-2">
                <div className="text-xs font-semibold text-navy mb-1">{resolveStaffName(staffId, staffNameById)}</div>
                <div className="text-xs text-gray-600">{group.map((d) => `${d.firstName} ${d.lastName}`).join(", ")}</div>
                {group.length > 4 && (
                  <div className="text-xs text-orange bg-orange-light border border-orange/20 rounded-md px-2 py-1 mt-1">
                    This team is over the 1:4 ratio. Please check the plan.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tank tally sits after the diver list, matching the old app's
            consistent bottom-of-block placement in every rendering context. */}
        <div className="bg-navy text-white rounded-md px-3 py-2.5 text-xs font-semibold flex gap-4 flex-wrap">
          <span>12L: {tally.air12l}</span>
          <span>15L: {tally.air15l}</span>
          <span>Nitrox: {tally.nitrox}</span>
          {detail.guestDiversCount ? (
            <span>Joining us: {detail.guestDiversCount} ({detail.guestDiveCenterName})</span>
          ) : null}
        </div>

        {!detail.closed && !detail.cancelled && !duplicates && (
          <div className="border-t border-gray-200 pt-3 flex items-end gap-3 flex-wrap">
            {canReturn ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => returnBoat()}
                disabled={pending || divers.length === 0}
              >
                {pending ? "Closing…" : "Boat Returned"}
              </Button>
            ) : (
              // Matches scheduling.html's real return-bar "wait" state —
              // disabled until departure time passes, instead of letting
              // the click reach the server just to fail there.
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="px-3 py-1.5 border border-gray-200 rounded-md bg-gray-50 text-gray-400 font-medium">
                  Boat Returned
                </span>
                <span>Available at {formatTime12h(detail.departureTime!)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PhaseThreePanel({
  trips,
  boats,
  diveSites,
  staffOptions,
  onChanged,
}: {
  trips: TripSummary[];
  boats: BoatOption[];
  diveSites: DiveSiteOption[];
  staffOptions: StaffOption[];
  onChanged: () => void;
}) {
  const [crewToken, setCrewToken] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const showToast = useToast();

  // Matches scheduling.html's real behavior: the token is (re)computed
  // silently every time Phase 3 is viewed, whenever none exists yet for
  // today — there's no manual "Generate" click anywhere in the old app.
  useEffect(() => {
    getCrewTokenToday().then((existing) => {
      if (existing) setCrewToken(existing);
      else generateCrewToken().then((res) => setCrewToken(res.token ?? null));
    });
  }, []);

  async function copyAllPreview() {
    const texts = await Promise.all(
      saved.map(async (t) => {
        const [detail, divers, staffTanks] = await Promise.all([
          getTripDetail(t.scheduleId),
          getScheduleDivers(t.scheduleId),
          getStaffDiveTanks(t.scheduleId),
        ]);
        if (!detail) return "";
        const boat = detail.boatId ? (boats.find((b) => b.id === detail.boatId) ?? null) : null;
        const staffNameById = new Map(staffOptions.map((s) => [s.id, s.fullName]));
        return tripPreviewText(detail, boat, diveSites, divers, staffTanks, staffNameById);
      }),
    );
    const combined =
      texts.filter(Boolean).join("\n\n------------------------------\n\n") +
      (crewToken ? `\n\n------------------------------\n\nSchedule Token: ${crewToken}` : "");
    await navigator.clipboard.writeText(combined);
    showToast("Copied.");
  }

  const saved = trips.filter((t) => !t.cancelled);

  return (
    <div className="grid gap-4" ref={previewRef}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Crew Code:</span>
          {crewToken ? (
            <span className="font-mono font-semibold text-navy bg-off-white px-2 py-1 rounded">{crewToken}</span>
          ) : (
            <span className="text-gray-400">Generating…</span>
          )}
        </div>
        {saved.length > 0 && (
          <Button variant="ghost" size="sm" onClick={copyAllPreview}>
            Copy Preview
          </Button>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
          No saved trips for this date yet.
        </div>
      ) : (
        saved.map((t) => (
          <TripSummaryCard
            key={t.scheduleId}
            scheduleId={t.scheduleId}
            boats={boats}
            diveSites={diveSites}
            staffOptions={staffOptions}
            onReturned={onChanged}
          />
        ))
      )}
    </div>
  );
}
