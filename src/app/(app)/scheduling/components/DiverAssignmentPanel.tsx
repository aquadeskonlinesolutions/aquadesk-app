"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type {
  DiverPickResult,
  GroupOption,
  ScheduleDiverRow,
  StaffOption,
  CourseRateOption,
  BoatOption,
  DayAssignment,
} from "../data";
import {
  searchDivers,
  getActiveGroups,
  getGroupMembers,
  getScheduleDivers,
  saveTripDiverAssignments,
  getTripDetail,
  getDayAssignmentsForWarnings,
  type DiverAssignmentInput,
} from "../actions";
import { EXPERIENCE_TYPE_LABELS } from "../constants";
import { ExperienceTypeModal, type PendingTag } from "./ExperienceTypeModal";
import { WarningsBanner } from "./WarningsBanner";

type AssignmentRow = DiverAssignmentInput & {
  firstName: string;
  lastName: string;
  certificationLevel: string;
  nitroxCertified: boolean;
};

export function DiverAssignmentPanel({
  scheduleId,
  scheduleDate,
  staffOptions,
  courseRates,
  boats,
  onSaved,
}: {
  scheduleId: string;
  scheduleDate: string;
  staffOptions: StaffOption[];
  courseRates: CourseRateOption[];
  boats: BoatOption[];
  onSaved: () => void;
}) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiverPickResult[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [pendingTag, setPendingTag] = useState<DiverPickResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [boatId, setBoatId] = useState<string | null>(null);
  const [dayContext, setDayContext] = useState<DayAssignment[]>([]);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getTripDetail(scheduleId).then((d) => setBoatId(d?.boatId ?? null));
    getDayAssignmentsForWarnings(scheduleDate, scheduleId).then(setDayContext);
  }, [scheduleId, scheduleDate]);

  useEffect(() => {
    getScheduleDivers(scheduleId).then((rows: ScheduleDiverRow[]) => {
      setAssignments(
        rows.map((r) => ({
          diverId: r.diverId,
          firstName: r.firstName,
          lastName: r.lastName,
          certificationLevel: r.certificationLevel,
          nitroxCertified: r.nitroxCertified,
          openVisitId: null,
          staffId: r.staffId,
          experienceType: r.experienceType ?? "fun_diving",
          courseRateId: null,
          is15L: r.is15L,
          nitroxRequested: r.nitroxRequested,
          rememberStaffPairing: false,
        })),
      );
      setLoaded(true);
    });
    getActiveGroups().then(setGroups);
  }, [scheduleId]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchDivers(value, scheduleDate, scheduleId));
      });
    }, 300);
  }

  function addCandidates(candidates: DiverPickResult[]) {
    const already = new Set(assignments.map((a) => a.diverId));
    const fresh = candidates.filter((c) => !already.has(c.id));
    if (fresh.length === 0) return;

    const withVisit = fresh.filter((c) => c.openVisitId);
    const withoutVisit = fresh.filter((c) => !c.openVisitId);

    if (withVisit.length > 0) {
      setAssignments((prev) => [
        ...prev,
        ...withVisit.map((c) => ({
          diverId: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          certificationLevel: c.certificationLevel,
          nitroxCertified: c.nitroxCertified,
          openVisitId: c.openVisitId,
          staffId: c.suggestedStaffId,
          experienceType: c.openVisitExperienceType ?? "fun_diving",
          courseRateId: null,
          is15L: false,
          nitroxRequested: false,
          rememberStaffPairing: !!c.suggestedStaffId,
        })),
      ]);
    }
    if (withoutVisit.length > 0) {
      setPendingTag(withoutVisit);
    }
  }

  function confirmTags(tags: PendingTag[]) {
    const byId = new Map(pendingTag?.map((c) => [c.id, c]) ?? []);
    setAssignments((prev) => [
      ...prev,
      ...tags.map((t) => {
        const c = byId.get(t.diverId);
        return {
          diverId: t.diverId,
          firstName: t.firstName,
          lastName: t.lastName,
          certificationLevel: c?.certificationLevel ?? "",
          nitroxCertified: c?.nitroxCertified ?? false,
          openVisitId: null,
          staffId: c?.suggestedStaffId ?? null,
          experienceType: t.experienceType,
          courseRateId: t.courseRateId,
          is15L: false,
          nitroxRequested: false,
          rememberStaffPairing: !!c?.suggestedStaffId,
        };
      }),
    ]);
    setPendingTag(null);
  }

  function updateRow(diverId: string, patch: Partial<AssignmentRow>) {
    setAssignments((prev) => prev.map((a) => (a.diverId === diverId ? { ...a, ...patch } : a)));
  }

  function removeRow(diverId: string) {
    setAssignments((prev) => prev.filter((a) => a.diverId !== diverId));
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await saveTripDiverAssignments(scheduleId, assignments);
      if (res.error) setError(res.error);
      else {
        setMessage("Diver assignments saved.");
        onSaved();
      }
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-navy">
        Divers on This Trip
      </div>

      <div className="p-4 grid gap-4">
        {error && <div className="text-sm text-red">{error}</div>}
        {message && <div className="text-sm text-teal">{message}</div>}

        <div className="grid gap-2">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search divers by name…"
            className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
          />
          {results.length > 0 && (
            <div className="flex flex-col gap-1 border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => addCandidates([r])}
                  className="text-left px-2 py-1.5 text-sm rounded hover:bg-off-white flex items-center justify-between gap-2"
                >
                  <span>
                    {r.firstName} {r.lastName}{" "}
                    <span className="text-xs text-gray-400">
                      {r.certificationLevel}
                      {r.groupName ? ` · ${r.groupName}` : ""}
                    </span>
                  </span>
                  {r.alreadyScheduledToday && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Already on another trip today
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {groups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    startTransition(async () => {
                      addCandidates(await getGroupMembers(g.id, scheduleDate, scheduleId));
                    });
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  + {g.groupName} ({g.memberCount})
                </button>
              ))}
            </div>
          )}
        </div>

        {loaded && assignments.length > 0 && (
          <WarningsBanner
            assignments={assignments}
            boatCapacity={boats.find((b) => b.id === boatId)?.capacity ?? null}
            dayContext={dayContext}
            boatId={boatId}
            staffOptions={staffOptions}
          />
        )}

        {loaded && assignments.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">No divers assigned yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map((a) => (
              <div key={a.diverId} className="border border-gray-200 rounded-lg p-3 grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-navy">
                    {a.firstName} {a.lastName}
                    <span className="text-xs text-gray-400 font-normal ml-2">
                      {a.certificationLevel} · {EXPERIENCE_TYPE_LABELS[a.experienceType]}
                    </span>
                  </div>
                  <button onClick={() => removeRow(a.diverId)} className="text-xs text-red hover:underline">
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={a.staffId ?? ""}
                    onChange={(e) => updateRow(a.diverId, { staffId: e.target.value || null })}
                    className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                  >
                    <option value="">No staff assigned</option>
                    {staffOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={a.experienceType}
                    onChange={(e) =>
                      updateRow(a.diverId, { experienceType: e.target.value as "fun_diving" | "dive_course" })
                    }
                    className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                  >
                    <option value="fun_diving">Fun Diving</option>
                    <option value="dive_course">Dive Course</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={a.is15L}
                      onChange={(e) => updateRow(a.diverId, { is15L: e.target.checked })}
                    />
                    15L Tank
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={a.nitroxRequested}
                      onChange={(e) => updateRow(a.diverId, { nitroxRequested: e.target.checked })}
                    />
                    Nitrox
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={a.rememberStaffPairing}
                      onChange={(e) => updateRow(a.diverId, { rememberStaffPairing: e.target.checked })}
                    />
                    Remember this staff pairing for next time
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Divers"}
        </button>
      </div>

      {pendingTag && (
        <ExperienceTypeModal
          divers={pendingTag.map((c) => ({ diverId: c.id, firstName: c.firstName, lastName: c.lastName }))}
          courseRates={courseRates}
          onClose={() => setPendingTag(null)}
          onConfirm={confirmTags}
        />
      )}
    </div>
  );
}
