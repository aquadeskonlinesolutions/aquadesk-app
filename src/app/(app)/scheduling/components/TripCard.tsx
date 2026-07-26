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
  getClipsForDate,
  saveTripTeams,
  type TripFormInput,
  type TripTeamInput,
} from "../actions";
import { BOAT_MODE_OPTIONS } from "../constants";
import { WarningsBanner } from "./WarningsBanner";

type TeamDiver = {
  diverId: string;
  firstName: string;
  lastName: string;
  certificationLevel: string;
  nitroxCertified: boolean;
  is15L: boolean;
  nitroxRequested: boolean;
};

type Team = {
  staffId: string | null;
  staffName: string;
  sourceClipId: string | null;
  divers: TeamDiver[];
};

function emptyForm(scheduleDate: string): TripFormInput {
  return {
    scheduleDate,
    boatMode: "own_boat",
    boatId: null,
    joinerBoatName: "",
    departureTime: "",
    siteIds: [],
    notes: "",
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
    siteIds: detail.siteIds,
    notes: detail.notes ?? "",
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
    divers: clip.members
      .filter((m) => !m.excluded)
      .map((m) => ({
        diverId: m.diverId,
        firstName: m.firstName,
        lastName: m.lastName,
        certificationLevel: m.certificationLevel,
        nitroxCertified: m.nitroxCertified,
        is15L: false,
        nitroxRequested: false,
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

  useEffect(() => {
    if (!initialScheduleId) return;
    Promise.all([getTripDetail(initialScheduleId), getScheduleDivers(initialScheduleId)]).then(
      ([d, rows]) => {
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
            divers: [],
          };
          team.divers.push({
            diverId: r.diverId,
            firstName: r.firstName,
            lastName: r.lastName,
            certificationLevel: r.certificationLevel,
            nitroxCertified: r.nitroxCertified,
            is15L: r.is15L,
            nitroxRequested: r.nitroxRequested,
          });
          byKey.set(key, team);
        });
        // Resolve staff names from staffOptions since schedule_divers doesn't store the name.
        const resolved = [...byKey.values()].map((t) => ({
          ...t,
          staffName: staffOptions.find((s) => s.id === t.staffId)?.fullName ?? "Unassigned",
        }));
        setTeams(resolved);
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScheduleId]);

  const locked = readOnly || (detail?.closed ?? false);
  const placedDiverIds = new Set(teams.flatMap((t) => t.divers.map((d) => d.diverId)));

  function toggleSite(siteId: string) {
    setForm((f) =>
      f.siteIds.includes(siteId)
        ? { ...f, siteIds: f.siteIds.filter((id) => id !== siteId) }
        : { ...f, siteIds: [...f.siteIds, siteId] },
    );
  }

  function removeDiverFromTeam(teamIndex: number, diverId: string) {
    setTeams((prev) => {
      const next = [...prev];
      next[teamIndex] = { ...next[teamIndex], divers: next[teamIndex].divers.filter((d) => d.diverId !== diverId) };
      return next.filter((t) => t.divers.length > 0);
    });
  }

  function toggleDiverFlag(teamIndex: number, diverId: string, flag: "is15L" | "nitroxRequested") {
    setTeams((prev) => {
      const next = [...prev];
      next[teamIndex] = {
        ...next[teamIndex],
        divers: next[teamIndex].divers.map((d) =>
          d.diverId === diverId
            ? flag === "is15L"
              ? { ...d, is15L: !d.is15L, nitroxRequested: false }
              : { ...d, nitroxRequested: !d.nitroxRequested, is15L: false }
            : d,
        ),
      };
      return next;
    });
  }

  async function save() {
    setError(null);
    if (form.siteIds.length === 0) {
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
    if (teams.length === 0) {
      setError("Add at least one team before saving.");
      return;
    }

    startTransition(async () => {
      let id = scheduleId;
      if (!id) {
        const res = await createTrip(form);
        if (res.error) {
          setError(res.error);
          return;
        }
        id = res.scheduleId!;
        setScheduleId(id);
      } else {
        const res = await updateTrip(id, form);
        if (res.error) {
          setError(res.error);
          return;
        }
      }

      const teamInputs: TripTeamInput[] = teams.map((t) => ({
        staffId: t.staffId,
        staffName: t.staffName,
        sourceClipId: t.sourceClipId,
        divers: t.divers.map((d) => ({ diverId: d.diverId, is15L: d.is15L, nitroxRequested: d.nitroxRequested })),
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

  function remove() {
    if (!scheduleId) return;
    if (!window.confirm("Delete this trip? This can't be undone.")) return;
    startTransition(async () => {
      const res = await deleteTrip(scheduleId);
      if (res.error) setError(res.error);
      else {
        onDeletedOrCancelled();
        onTeamsChanged();
      }
    });
  }

  function cancel() {
    if (!scheduleId) return;
    if (!window.confirm("Cancel this trip? It stays on record but no longer counts as active.")) return;
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
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  const diveCount = form.siteIds.length || 1;
  let air12l = 0;
  let air15l = 0;
  let nitrox = 0;
  teams.forEach((t) =>
    t.divers.forEach((d) => {
      if (d.nitroxRequested) nitrox += diveCount;
      else if (d.is15L) air15l += diveCount;
      else air12l += diveCount;
    }),
  );

  const warningAssignments = teams.flatMap((t) =>
    t.divers.map((d) => ({
      diverId: d.diverId,
      staffId: t.staffId,
      certificationLevel: d.certificationLevel,
      nitroxRequested: d.nitroxRequested,
    })),
  );
  const boat = form.boatId ? boats.find((b) => b.id === form.boatId) : null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="text-sm font-semibold text-navy">{scheduleId ? "Trip" : "New Trip"}</div>
        {detail?.cancelled && (
          <span className="text-xs bg-red/10 text-red px-2 py-0.5 rounded-full">Cancelled</span>
        )}
      </div>

      <div className="p-4 grid gap-4">
        {error && <div className="text-sm text-red">{error}</div>}
        {locked && (
          <div className="text-xs bg-teal/10 text-teal px-3 py-2 rounded-md">
            This trip is locked — fields can&apos;t be edited.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Departure Time</label>
            <input
              type="time"
              disabled={locked}
              value={form.departureTime}
              onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
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

          <div className="col-span-2 grid grid-cols-3 gap-3 border border-gray-200 rounded-md p-3 bg-gray-50">
            <div className="col-span-3 text-xs font-medium text-gray-500">
              Other divers joining this boat (optional)
            </div>
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

          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Dive Sites</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {diveSites.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={locked}
                  onClick={() => toggleSite(s.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                    form.siteIds.includes(s.id)
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-gray-600 border-gray-300"
                  } disabled:opacity-60`}
                >
                  {s.siteName}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              disabled={locked}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-navy">Teams</div>
            {!locked && (
              <button
                onClick={() => setShowAddTeam(true)}
                className="px-3 py-1.5 text-xs font-medium text-navy border border-gray-300 rounded-md hover:bg-gray-100"
              >
                + Add Team
              </button>
            )}
          </div>

          {teams.length === 0 ? (
            <div className="text-xs text-gray-400">No teams assigned yet.</div>
          ) : (
            <div className="grid gap-2">
              {teams.map((t, ti) => (
                <div key={`${t.staffId ?? "none"}-${t.sourceClipId ?? ti}`} className="border border-gray-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-navy mb-1">{t.staffName}</div>
                  <div className="grid gap-1">
                    {t.divers.map((d) => (
                      <div key={d.diverId} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">
                          {d.firstName} {d.lastName}{" "}
                          <span className="text-gray-400">({d.certificationLevel})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-gray-500">
                            <input
                              type="checkbox"
                              disabled={locked}
                              checked={d.is15L}
                              onChange={() => toggleDiverFlag(ti, d.diverId, "is15L")}
                            />
                            15L
                          </label>
                          <label className="flex items-center gap-1 text-gray-500">
                            <input
                              type="checkbox"
                              disabled={locked}
                              checked={d.nitroxRequested}
                              onChange={() => toggleDiverFlag(ti, d.diverId, "nitroxRequested")}
                            />
                            Nitrox
                          </label>
                          {!locked && (
                            <button
                              onClick={() => removeDiverFromTeam(ti, d.diverId)}
                              className="text-red text-xs hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {teams.length > 0 && (
            <div className="flex gap-2 mt-2 text-xs">
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Air 12L: {air12l}</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Air 15L: {air15l}</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Nitrox: {nitrox}</span>
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
        </div>
      </div>

      {!readOnly && (
        <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
          {scheduleId && !locked && (
            <>
              <button
                onClick={remove}
                disabled={pending}
                className="px-3 py-1.5 text-xs font-medium text-red border border-red/30 rounded-md hover:bg-red/5"
              >
                Delete
              </button>
              {!detail?.cancelled && (
                <button
                  onClick={cancel}
                  disabled={pending}
                  className="px-3 py-1.5 text-xs font-medium text-navy border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel Trip
                </button>
              )}
            </>
          )}
          {!locked && (
            <button
              onClick={save}
              disabled={pending}
              className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save Trip"}
            </button>
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
