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
  if (boat?.captain) lines.push(`Captain: ${boat.captain}`);
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
  const [fuelLiters, setFuelLiters] = useState("");
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
  });

  function returnBoat(options: { excludeDiverIds?: string[]; forceProceed?: boolean } = {}) {
    setError(null);
    setSkipped(null);
    startTransition(async () => {
      const res = await markBoatReturned(scheduleId, fuelLiters.trim() ? Number(fuelLiters) : null, options);
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

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 grid gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-navy">
            {detail.isJoiner ? (detail.joinerBoatName ?? "Join Ride") : (boat?.name ?? "Boat")}
          </div>
          <div className="text-xs text-gray-500">
            {detail.departureTime ?? "No time"} {boat?.captain ? `· Captain ${boat.captain}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detail.closed && <span className="text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full">Returned</span>}
          {detail.cancelled && (
            <span className="text-xs bg-red/10 text-red px-2 py-0.5 rounded-full">Cancelled</span>
          )}
          <button
            onClick={() =>
              downloadTripImage(
                tripPreviewText(detail, boat, diveSites, divers, staffTanks, staffNameById),
                `${detail.scheduleDate} - ${boat?.name ?? detail.joinerBoatName ?? "trip"} - ${detail.departureTime ?? ""}.png`,
              )
            }
            className="text-xs text-navy border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-100"
          >
            Download Image
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red">{error}</div>}
      {skipped && (
        <div className="text-xs bg-amber-100 text-amber-700 px-3 py-2 rounded-md">
          No open visit found for: {skipped.join(", ")} — their activity rows were skipped.
        </div>
      )}
      {duplicates && (
        <div className="text-xs bg-amber-100 text-amber-700 px-3 py-2 rounded-md grid gap-2">
          <div>
            Activities already logged today for: {duplicates.map((d) => d.name).join(", ")}. Log again anyway, or
            exclude them from this return?
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => returnBoat({ excludeDiverIds: duplicates.map((d) => d.diverId) })}
              className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Exclude Divers
            </button>
            <button
              onClick={() => returnBoat({ forceProceed: true })}
              className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Proceed Anyway
            </button>
            <button onClick={() => setDuplicates(null)} className="px-2 py-1 text-gray-500">
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
            </div>
          ))}
        </div>
      )}

      {/* Tank tally sits after the diver list, matching the old app's
          consistent bottom-of-block placement in every rendering context. */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span>12L: {tally.air12l}</span>
        <span>15L: {tally.air15l}</span>
        <span>Nitrox: {tally.nitrox}</span>
        {detail.guestDiversCount ? (
          <span>Joining us: {detail.guestDiversCount} ({detail.guestDiveCenterName})</span>
        ) : null}
      </div>

      {!detail.closed && !detail.cancelled && !duplicates && (
        <div className="border-t border-gray-200 pt-3 flex items-end gap-3 flex-wrap">
          {!detail.isJoiner && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Consumed (liters)</label>
              <input
                type="number"
                min={0}
                value={fuelLiters}
                onChange={(e) => setFuelLiters(e.target.value)}
                className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-32"
              />
            </div>
          )}
          <button
            onClick={() => returnBoat()}
            disabled={pending || divers.length === 0}
            className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
          >
            {pending ? "Closing…" : "Boat Returned"}
          </button>
        </div>
      )}
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
    window.alert("Copied.");
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
          <button
            onClick={copyAllPreview}
            className="text-xs text-navy border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-100"
          >
            Copy Preview
          </button>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
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
