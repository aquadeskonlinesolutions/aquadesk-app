"use client";

import { useEffect, useState, useTransition } from "react";
import type { BoatOption, DiveSiteOption, TripDetail, StaffOption, Clip, DayAssignment } from "../data";
import {
  createTrip,
  updateTrip,
  deleteTrip,
  cancelTrip,
  getTripDetail,
  getScheduleDivers,
  getStaffDiveTanks,
  getClipsForDate,
  saveTripTeams,
  type TripFormInput,
  type TripTeamInput,
} from "../actions";
import { BOAT_MODE_OPTIONS, CERT_LEVEL_LABELS } from "../constants";
import { WarningsBanner } from "./WarningsBanner";
import { computeTankTally } from "../tanks";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { SectionBox } from "@/components/ui/SectionBox";

// Cycled per team index, matching scheduling.html's real per-team
// left-accent color coding (.team-card.c1..c6) — this app's palette has
// no purple, so it cycles through the tokens that do exist.
const TEAM_ACCENT_COLORS = ["border-navy", "border-teal", "border-orange", "border-green"];

type DiverTank = { siteIndex: number; tankType: "nitrox" | "air_15l" };

type TeamDiver = {
  diverId: string;
  firstName: string;
  lastName: string;
  certificationLevel: string;
  nitroxCertified: boolean;
  tanks: DiverTank[];
  experienceType: "fun_diving" | "dive_course" | null;
};

type Team = {
  staffId: string | null;
  staffName: string;
  sourceClipId: string | null;
  staffNitroxSiteIndexes: number[];
  divers: TeamDiver[];
};

function tankAt(tanks: DiverTank[], siteIndex: number): "air_12l" | "nitrox" | "air_15l" {
  return tanks.find((t) => t.siteIndex === siteIndex)?.tankType ?? "air_12l";
}

// Dive-site slots are shown as 3 default dropdown rows ("Dive Site 1/2/3"),
// matching scheduling.html's real sites:['','',''] seeding — an empty
// string is an unfilled slot, not a real selection. "+ Add Dive Site"
// appends more. Filtered down to real, non-empty ids only at save time.
const MIN_SITE_SLOTS = 3;
// Crew follows the identical pattern — scheduling.html's real
// t.crews:['','',''] default, "+ Add Crew" appends more slots.
const MIN_CREW_SLOTS = 3;

function padSiteSlots(siteIds: string[]): string[] {
  const slots = [...siteIds];
  while (slots.length < MIN_SITE_SLOTS) slots.push("");
  return slots;
}

function padCrewSlots(crew: string[]): string[] {
  const slots = [...crew];
  while (slots.length < MIN_CREW_SLOTS) slots.push("");
  return slots;
}

// Departure time is stored as a 24h "HH:MM" string (matching the
// schedules.departure_time column) but scheduling.html's real UI is 3
// dropdowns (Hour 1-12 / Minute / AM-PM) — converted at the edges so the
// stored value/validation stay unchanged.
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function to12h(time24: string): { hour: string; minute: string; ampm: "AM" | "PM" } {
  if (!time24) return { hour: "", minute: "", ampm: "AM" };
  const [hStr, mStr] = time24.split(":");
  const h24 = parseInt(hStr, 10);
  const ampm: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour: String(h12), minute: mStr ?? "00", ampm };
}

function to24h(hour: string, minute: string, ampm: "AM" | "PM"): string {
  if (!hour || !minute) return "";
  let h = parseInt(hour, 10) % 12;
  if (ampm === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function emptyForm(scheduleDate: string): TripFormInput {
  return {
    scheduleDate,
    boatMode: "own_boat",
    boatId: null,
    joinerBoatName: "",
    departureTime: "",
    captain: "",
    crew: padCrewSlots([]),
    siteIds: padSiteSlots([]),
    notes: "",
    fuelConsumedLiters: null,
    guestDiversCount: null,
    guestDiveCenterName: "",
    guestNotes: "",
  };
}

function fromDetail(detail: TripDetail): TripFormInput {
  return {
    scheduleDate: detail.scheduleDate,
    boatMode: detail.isJoiner ? "join_ride" : "own_boat",
    boatId: detail.boatId,
    joinerBoatName: detail.joinerBoatName ?? "",
    departureTime: detail.departureTime ?? "",
    captain: detail.captain ?? "",
    crew: padCrewSlots(detail.crew),
    siteIds: padSiteSlots(detail.siteIds),
    notes: detail.notes ?? "",
    fuelConsumedLiters: detail.fuelConsumedLiters,
    guestDiversCount: detail.guestDiversCount,
    guestDiveCenterName: detail.guestDiveCenterName ?? "",
    guestNotes: detail.guestNotes ?? "",
  };
}

function clipToTeam(clip: Clip): Team {
  return {
    staffId: clip.staffId,
    staffName: clip.staffName,
    sourceClipId: clip.id,
    staffNitroxSiteIndexes: [],
    divers: clip.members
      .filter((m) => !m.excluded)
      .map((m) => ({
        diverId: m.diverId,
        firstName: m.firstName,
        lastName: m.lastName,
        certificationLevel: m.certificationLevel,
        nitroxCertified: m.nitroxCertified,
        tanks: [],
        experienceType: m.experienceType,
      })),
  };
}

function AddTeamModal({
  scheduleDate,
  placedDiverIds,
  onClose,
  onAdd,
}: {
  scheduleDate: string;
  placedDiverIds: Set<string>;
  onClose: () => void;
  onAdd: (team: Team) => void;
}) {
  const [clips, setClips] = useState<Clip[] | null>(null);

  useEffect(() => {
    getClipsForDate(scheduleDate).then(setClips);
  }, [scheduleDate]);

  const available = (clips ?? [])
    .map((c) => ({ ...c, members: c.members.filter((m) => !m.excluded && !placedDiverIds.has(m.diverId)) }))
    .filter((c) => c.members.length > 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-lg text-navy">Add Team</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5 grid gap-2">
          {clips === null ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : available.length === 0 ? (
            <div className="text-sm text-gray-400">
              No unplaced team clips for this date — build one in Phase 1 first.
            </div>
          ) : (
            available.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onAdd(clipToTeam(c));
                  onClose();
                }}
                className="text-left border border-gray-200 rounded-lg p-3 hover:border-navy hover:bg-off-white transition-colors"
              >
                <div className="text-sm font-semibold text-navy">
                  {c.staffName}
                  {c.isFreelancer && <span className="ml-2 text-xs text-gray-400">(Freelancer)</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {c.members.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function TripCard({
  scheduleId: initialScheduleId,
  scheduleDate,
  boats,
  diveSites,
  staffOptions,
  dayContext,
  readOnly,
  onSaved,
  onDeletedOrCancelled,
  onTeamsChanged,
}: {
  scheduleId: string | null;
  scheduleDate: string;
  boats: BoatOption[];
  diveSites: DiveSiteOption[];
  staffOptions: StaffOption[];
  dayContext: DayAssignment[];
  readOnly: boolean;
  onSaved: (scheduleId: string) => void;
  onDeletedOrCancelled: () => void;
  onTeamsChanged: () => void;
}) {
  const [scheduleId, setScheduleId] = useState(initialScheduleId);
  const [form, setForm] = useState<TripFormInput>(emptyForm(scheduleDate));
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(!!initialScheduleId);
  const [error, setError] = useState<string | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const showToast = useToast();
  // Matches scheduling.html's real collapsible trip cards: a saved trip
  // defaults to its compact summary, a brand-new one starts open so it
  // can be filled in immediately.
  const [expanded, setExpanded] = useState(!initialScheduleId);

  useEffect(() => {
    if (!initialScheduleId) return;
    Promise.all([
      getTripDetail(initialScheduleId),
      getScheduleDivers(initialScheduleId),
      getStaffDiveTanks(initialScheduleId),
    ]).then(([d, rows, staffTanks]) => {
      if (d) {
        setForm(fromDetail(d));
        setDetail(d);
      }
      const byKey = new Map<string, Team>();
      rows.forEach((r) => {
        const key = `${r.staffId ?? "none"}::${r.sourceClipId ?? "none"}`;
        const team = byKey.get(key) ?? {
          staffId: r.staffId,
          staffName: "",
          sourceClipId: r.sourceClipId,
          staffNitroxSiteIndexes: [],
          divers: [],
        };
        team.divers.push({
          diverId: r.diverId,
          firstName: r.firstName,
          lastName: r.lastName,
          certificationLevel: r.certificationLevel,
          nitroxCertified: r.nitroxCertified,
          tanks: r.tanks,
          experienceType: r.experienceType,
        });
        byKey.set(key, team);
      });
      // Resolve staff names from staffOptions since schedule_divers doesn't store the name,
      // then match each team's per-site nitrox selection by that resolved name (how it was saved).
      const staffTanksByName = new Map(staffTanks.map((s) => [s.staffName, s.siteIndexes]));
      const resolved = [...byKey.values()].map((t) => {
        const staffName = staffOptions.find((s) => s.id === t.staffId)?.fullName ?? "Unassigned";
        return { ...t, staffName, staffNitroxSiteIndexes: staffTanksByName.get(staffName) ?? [] };
      });
      setTeams(resolved);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScheduleId]);

  const locked = readOnly || (detail?.closed ?? false);
  const placedDiverIds = new Set(teams.flatMap((t) => t.divers.map((d) => d.diverId)));

  function setSiteSlot(index: number, siteId: string) {
    setForm((f) => {
      const siteIds = [...f.siteIds];
      siteIds[index] = siteId;
      return { ...f, siteIds };
    });
  }

  function addSiteSlot() {
    setForm((f) => ({ ...f, siteIds: [...f.siteIds, ""] }));
  }

  function setCrewSlot(index: number, name: string) {
    setForm((f) => {
      const crew = [...f.crew];
      crew[index] = name;
      return { ...f, crew };
    });
  }

  function addCrewSlot() {
    setForm((f) => ({ ...f, crew: [...f.crew, ""] }));
  }

  function removeDiverFromTeam(teamIndex: number, diverId: string) {
    setTeams((prev) => {
      const next = [...prev];
      next[teamIndex] = { ...next[teamIndex], divers: next[teamIndex].divers.filter((d) => d.diverId !== diverId) };
      return next.filter((t) => t.divers.length > 0);
    });
  }

  // Two labeled toggles per dive site — matching scheduling.html's real
  // diverFlagsHTML()/toggleNitrox()/toggle15l(): a "Nitrox" checkbox row and
  // a separate "15L" checkbox row per diver, mutually exclusive per dive
  // (checking one while the other is already set for that same dive is
  // rejected with a toast, not silently overwritten) — clearer than a
  // single ambiguous cycling pill, and it's what the checked/unchecked
  // state actually communicates rather than requiring three clicks to
  // discover what each stage means.
  function toggleDiverNitrox(teamIndex: number, diverId: string, siteIndex: number) {
    const diver = teams[teamIndex]?.divers.find((d) => d.diverId === diverId);
    if (!diver) return;
    const current = tankAt(diver.tanks, siteIndex);
    if (current === "air_15l") {
      showToast("Choose either Nitrox or 15L for that dive.", "error");
      return;
    }
    const nextType = current === "nitrox" ? null : "nitrox";
    setTeams((prev) => {
      const next = [...prev];
      next[teamIndex] = {
        ...next[teamIndex],
        divers: next[teamIndex].divers.map((d) => {
          if (d.diverId !== diverId) return d;
          const tanks = d.tanks.filter((t) => t.siteIndex !== siteIndex);
          if (nextType) tanks.push({ siteIndex, tankType: nextType });
          return { ...d, tanks };
        }),
      };
      return next;
    });
  }

  function toggleDiverTank15l(teamIndex: number, diverId: string, siteIndex: number) {
    const diver = teams[teamIndex]?.divers.find((d) => d.diverId === diverId);
    if (!diver) return;
    const current = tankAt(diver.tanks, siteIndex);
    if (current === "nitrox") {
      showToast("Choose either Nitrox or 15L for that dive.", "error");
      return;
    }
    const nextType = current === "air_15l" ? null : "air_15l";
    setTeams((prev) => {
      const next = [...prev];
      next[teamIndex] = {
        ...next[teamIndex],
        divers: next[teamIndex].divers.map((d) => {
          if (d.diverId !== diverId) return d;
          const tanks = d.tanks.filter((t) => t.siteIndex !== siteIndex);
          if (nextType) tanks.push({ siteIndex, tankType: nextType });
          return { ...d, tanks };
        }),
      };
      return next;
    });
  }

  function toggleStaffNitrox(teamIndex: number, siteIndex: number) {
    setTeams((prev) => {
      const next = [...prev];
      const team = next[teamIndex];
      const has = team.staffNitroxSiteIndexes.includes(siteIndex);
      next[teamIndex] = {
        ...team,
        staffNitroxSiteIndexes: has
          ? team.staffNitroxSiteIndexes.filter((i) => i !== siteIndex)
          : [...team.staffNitroxSiteIndexes, siteIndex],
      };
      return next;
    });
  }

  async function save() {
    setError(null);
    const realSiteIds = form.siteIds.filter(Boolean);
    if (realSiteIds.length === 0) {
      setError("At least one dive site is required.");
      return;
    }
    if (form.boatMode === "own_boat" && !form.boatId) {
      setError("Select a boat.");
      return;
    }
    if (form.boatMode !== "own_boat" && !form.joinerBoatName.trim()) {
      setError("Boat name is required.");
      return;
    }
    if (form.boatMode === "own_boat" && !form.captain.trim()) {
      setError("Enter the boat captain before saving this trip.");
      return;
    }
    if (form.boatMode === "own_boat" && (form.fuelConsumedLiters === null || form.fuelConsumedLiters < 0)) {
      setError("Enter the fuel consumption in liters before saving this trip.");
      return;
    }
    if (teams.length === 0) {
      setError("Add at least one team before saving.");
      return;
    }

    const payload: TripFormInput = { ...form, siteIds: realSiteIds };

    startTransition(async () => {
      let id = scheduleId;
      if (!id) {
        const res = await createTrip(payload);
        if (res.error) {
          setError(res.error);
          return;
        }
        id = res.scheduleId!;
        setScheduleId(id);
      } else {
        const res = await updateTrip(id, payload);
        if (res.error) {
          setError(res.error);
          return;
        }
      }

      const teamInputs: TripTeamInput[] = teams.map((t) => ({
        staffId: t.staffId,
        staffName: t.staffName,
        sourceClipId: t.sourceClipId,
        staffNitroxSiteIndexes: t.staffNitroxSiteIndexes,
        divers: t.divers.map((d) => ({
          diverId: d.diverId,
          tanks: d.tanks,
          experienceType: d.experienceType,
        })),
      }));
      const teamRes = await saveTripTeams(id, teamInputs);
      if (teamRes.error) {
        setError(teamRes.error);
        return;
      }

      onSaved(id);
      onTeamsChanged();
    });
  }

  async function remove() {
    if (!scheduleId) return;
    if (!(await confirm("Delete this trip? This can't be undone.", { danger: true }))) return;
    startTransition(async () => {
      const res = await deleteTrip(scheduleId);
      if (res.error) setError(res.error);
      else {
        onDeletedOrCancelled();
        onTeamsChanged();
      }
    });
  }

  async function cancel() {
    if (!scheduleId) return;
    if (!(await confirm("Cancel this trip? It stays on record but no longer counts as active.", { danger: true })))
      return;
    startTransition(async () => {
      const res = await cancelTrip(scheduleId);
      if (res.error) setError(res.error);
      else {
        onDeletedOrCancelled();
        onTeamsChanged();
      }
    });
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  const realSiteIds = form.siteIds.filter(Boolean);
  const tally = computeTankTally({
    siteCount: realSiteIds.length,
    diverTanks: teams.flatMap((t) => t.divers.map((d) => d.tanks)),
    staffNitroxSiteIndexesByTeam: teams.map((t) => t.staffNitroxSiteIndexes),
  });

  const warningAssignments = teams.flatMap((t) =>
    t.divers.map((d) => ({
      diverId: d.diverId,
      staffId: t.staffId,
      certificationLevel: d.certificationLevel,
      nitroxRequested: d.tanks.some((tk) => tk.tankType === "nitrox"),
    })),
  );
  const boat = form.boatId ? boats.find((b) => b.id === form.boatId) : null;
  const diverCount = teams.reduce((sum, t) => sum + t.divers.length, 0);
  const headerTitle = form.boatMode === "own_boat" ? (boat?.name ?? "New Trip") : form.joinerBoatName || "New Trip";
  const headerSub = [
    form.departureTime || "No time",
    `${diverCount} diver${diverCount === 1 ? "" : "s"}`,
  ].join(" · ");

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-navy text-white px-4 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left min-w-0"
        >
          <div className="font-extrabold text-sm truncate">{headerTitle}</div>
          <div className="text-xs text-white/70 truncate">{headerSub}</div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {detail?.cancelled && (
            <span className="text-xs bg-red/20 text-white px-2 py-0.5 rounded-full">Cancelled</span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-white/80 border border-white/30 rounded-md px-2 py-1 hover:bg-white/10"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          {!readOnly && scheduleId && !locked && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-xs font-medium text-white bg-red/80 rounded-md px-2 py-1 hover:bg-red disabled:opacity-60"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {expanded && (
      <div className="p-4 grid gap-4">
        {error && <div className="text-sm text-red">{error}</div>}
        {locked && (
          <div className="text-xs bg-teal/10 text-teal px-3 py-2 rounded-md">
            This trip is locked — fields can&apos;t be edited.
          </div>
        )}

        <SectionBox title="Trip Details">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Departure Time</label>
              <div className="grid grid-cols-3 gap-2">
                {(() => {
                  const dt = to12h(form.departureTime);
                  return (
                    <>
                      <select
                        disabled={locked}
                        value={dt.hour}
                        onChange={(e) =>
                          setForm({ ...form, departureTime: to24h(e.target.value, dt.minute || "00", dt.ampm) })
                        }
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                      >
                        <option value="">Hour</option>
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <select
                        disabled={locked}
                        value={dt.minute}
                        onChange={(e) =>
                          setForm({ ...form, departureTime: to24h(dt.hour || "12", e.target.value, dt.ampm) })
                        }
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                      >
                        <option value="">Min</option>
                        {MINUTES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        disabled={locked}
                        value={dt.ampm}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            departureTime: to24h(dt.hour || "12", dt.minute || "00", e.target.value as "AM" | "PM"),
                          })
                        }
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Boat</label>
              <div className="inline-flex border border-gray-200 rounded-md overflow-hidden w-full">
                {BOAT_MODE_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={locked}
                    onClick={() => setForm({ ...form, boatMode: value as TripFormInput["boatMode"] })}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium ${
                      form.boatMode === value ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                    } disabled:opacity-60`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {form.boatMode === "own_boat" ? (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Which Boat</label>
                <select
                  disabled={locked}
                  value={form.boatId ?? ""}
                  onChange={(e) => setForm({ ...form, boatId: e.target.value || null })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                >
                  <option value="">Select a boat…</option>
                  {boats.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.capacity ? ` (capacity ${b.capacity})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.boatMode === "rental" ? "Rental Boat Name" : "Their Boat Name"}
                </label>
                <input
                  disabled={locked}
                  value={form.joinerBoatName}
                  onChange={(e) => setForm({ ...form, joinerBoatName: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                />
              </div>
            )}

            {form.boatMode === "own_boat" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Boat Captain</label>
                  <input
                    disabled={locked}
                    value={form.captain}
                    onChange={(e) => setForm({ ...form, captain: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Consumption (L)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={locked}
                    value={form.fuelConsumedLiters ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fuelConsumedLiters: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                  />
                </div>
              </>
            )}
          </div>
        </SectionBox>

        {form.boatMode === "own_boat" && (
          <SectionBox title="Dive Crew">
            <div className="grid grid-cols-3 gap-2">
              {form.crew.map((name, i) => (
                <input
                  key={i}
                  disabled={locked}
                  value={name}
                  placeholder={`Crew ${i + 1}`}
                  onChange={(e) => setCrewSlot(i, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                />
              ))}
            </div>
            {!locked && (
              <Button type="button" variant="ghost" size="sm" onClick={addCrewSlot} className="mt-2">
                + Add Crew
              </Button>
            )}
          </SectionBox>
        )}

        <SectionBox title="Dive Sites">
          <div className="grid grid-cols-3 gap-2">
            {form.siteIds.map((siteId, i) => (
              <select
                key={i}
                disabled={locked}
                value={siteId}
                onChange={(e) => setSiteSlot(i, e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
              >
                <option value="">Dive {i + 1} — Select site</option>
                {diveSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteName}
                  </option>
                ))}
              </select>
            ))}
          </div>
          {!locked && (
            <Button type="button" variant="ghost" size="sm" onClick={addSiteSlot} className="mt-2">
              + Add Dive Site
            </Button>
          )}
        </SectionBox>

        <SectionBox title="Notes">
          <textarea
            disabled={locked}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
          />
        </SectionBox>

        <SectionBox
          title="Team Assignment"
          action={
            !locked && (
              <Button variant="ghost" size="sm" onClick={() => setShowAddTeam(true)}>
                + Add Team
              </Button>
            )
          }
        >

          {realSiteIds.length > 0 && teams.length > 0 && (
            <div className="text-[10px] text-gray-400 mb-2">
              Per dive site — choose either Nitrox or 15L for the same dive.
            </div>
          )}

          {teams.length === 0 ? (
            <div className="text-xs text-gray-400">No teams assigned yet.</div>
          ) : (
            <div className="grid gap-2">
              {teams.map((t, ti) => (
                <div
                  key={`${t.staffId ?? "none"}-${t.sourceClipId ?? ti}`}
                  className={`border border-gray-200 border-l-4 ${TEAM_ACCENT_COLORS[ti % TEAM_ACCENT_COLORS.length]} rounded-lg p-3`}
                >
                  <div className="text-sm font-medium text-navy mb-1">{t.staffName}</div>
                  {realSiteIds.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-[10px] font-semibold text-gray-500 w-16 shrink-0">Staff Nitrox</span>
                      {realSiteIds.map((siteId, si) => {
                        const active = t.staffNitroxSiteIndexes.includes(si);
                        const siteName = diveSites.find((s) => s.id === siteId)?.siteName ?? `Dive ${si + 1}`;
                        return (
                          <button
                            key={si}
                            type="button"
                            disabled={locked}
                            onClick={() => toggleStaffNitrox(ti, si)}
                            title={`Nitrox – Dive ${si + 1} (${siteName})`}
                            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
                              active ? "bg-teal text-white border-teal" : "bg-white text-gray-500 border-gray-300"
                            } disabled:opacity-60`}
                          >
                            D{si + 1}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid gap-2">
                    {t.divers.map((d) => (
                      <div key={d.diverId} className="border border-gray-100 rounded-md px-2 py-1.5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-700">
                            {d.firstName} {d.lastName}{" "}
                            <span className="text-gray-400">
                              ({CERT_LEVEL_LABELS[d.certificationLevel] ?? d.certificationLevel})
                            </span>
                          </span>
                          {!locked && (
                            <button
                              onClick={() => removeDiverFromTeam(ti, d.diverId)}
                              className="text-red text-xs hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {realSiteIds.length > 0 && (
                          <div className="grid gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-gray-500 w-10 shrink-0">Nitrox</span>
                              {d.nitroxCertified ? (
                                realSiteIds.map((siteId, si) => {
                                  const checked = tankAt(d.tanks, si) === "nitrox";
                                  const siteName = diveSites.find((s) => s.id === siteId)?.siteName ?? `Dive ${si + 1}`;
                                  return (
                                    <label
                                      key={si}
                                      title={siteName}
                                      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border cursor-pointer ${
                                        checked ? "bg-teal text-white border-teal" : "bg-white text-gray-500 border-gray-300"
                                      } ${locked ? "opacity-60 pointer-events-none" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={locked}
                                        onChange={() => toggleDiverNitrox(ti, d.diverId, si)}
                                        className="hidden"
                                      />
                                      D{si + 1}
                                    </label>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">Not nitrox certified</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-gray-500 w-10 shrink-0">15L</span>
                              {realSiteIds.map((siteId, si) => {
                                const checked = tankAt(d.tanks, si) === "air_15l";
                                const siteName = diveSites.find((s) => s.id === siteId)?.siteName ?? `Dive ${si + 1}`;
                                return (
                                  <label
                                    key={si}
                                    title={siteName}
                                    className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border cursor-pointer ${
                                      checked ? "bg-navy text-white border-navy" : "bg-white text-gray-500 border-gray-300"
                                    } ${locked ? "opacity-60 pointer-events-none" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={locked}
                                      onChange={() => toggleDiverTank15l(ti, d.diverId, si)}
                                      className="hidden"
                                    />
                                    D{si + 1}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {teams.length > 0 && (
            <div className="mt-3 bg-navy text-white rounded-md px-3 py-2.5 text-xs font-semibold flex gap-4">
              <span>Air 12L: {tally.air12l}</span>
              <span>Air 15L: {tally.air15l}</span>
              <span>Nitrox: {tally.nitrox}</span>
            </div>
          )}

          <div className="mt-3">
            <WarningsBanner
              assignments={warningAssignments}
              boatCapacity={boat?.capacity ?? null}
              dayContext={dayContext.filter((d) => d.scheduleId !== scheduleId)}
              boatId={form.boatId}
              staffOptions={staffOptions}
            />
          </div>
        </SectionBox>

        {(form.boatMode === "own_boat" || form.boatMode === "rental") && (
          <SectionBox title="Other Divers Joining This Boat">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Divers Joining</label>
                <input
                  type="number"
                  min={0}
                  disabled={locked}
                  value={form.guestDiversCount ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, guestDiversCount: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Their Dive Center</label>
                <input
                  disabled={locked}
                  value={form.guestDiveCenterName}
                  onChange={(e) => setForm({ ...form, guestDiveCenterName: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  disabled={locked}
                  value={form.guestNotes}
                  onChange={(e) => setForm({ ...form, guestNotes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
                />
              </div>
            </div>
          </SectionBox>
        )}
      </div>
      )}

      {!readOnly && expanded && (
        <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
          {scheduleId && !locked && !detail?.cancelled && (
            <Button variant="ghost" size="md" onClick={cancel} disabled={pending}>
              Cancel Trip
            </Button>
          )}
          {!locked && (
            <Button variant="primary" size="md" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save Trip"}
            </Button>
          )}
        </div>
      )}

      {showAddTeam && (
        <AddTeamModal
          scheduleDate={scheduleDate}
          placedDiverIds={placedDiverIds}
          onClose={() => setShowAddTeam(false)}
          onAdd={(team) => setTeams((prev) => [...prev, team])}
        />
      )}
    </div>
  );
}
