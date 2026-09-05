"use client";

import { useEffect, useState, useTransition } from "react";
import type { StaffOption, Clip, ClipMember, DiverPickResult, PhaseOneData } from "../data";
import {
  getPhaseOneData,
  createClip,
  excludeDiverFromClip,
  includeDiverInClip,
  moveDiverToClip,
  moveDiverToNewClip,
  deleteClip,
  updateClipStaff,
  excludeDiverForDay,
  includeDiverForDay,
} from "../actions";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { CERT_LEVEL_LABELS, ratioBadgeClass } from "../constants";

function StaffPicker({
  staffOptions,
  staffId,
  staffName,
  isFreelancer,
  onChange,
}: {
  staffOptions: StaffOption[];
  staffId: string | null;
  staffName: string;
  isFreelancer: boolean;
  onChange: (v: { staffId: string | null; staffName: string; isFreelancer: boolean }) => void;
}) {
  return (
    <div className="grid gap-2">
      <select
        value={isFreelancer ? "__freelancer__" : (staffId ?? "")}
        onChange={(e) => {
          if (e.target.value === "__freelancer__") {
            onChange({ staffId: null, staffName: "", isFreelancer: true });
          } else {
            const s = staffOptions.find((o) => o.id === e.target.value);
            onChange({ staffId: s?.id ?? null, staffName: s?.fullName ?? "", isFreelancer: false });
          }
        }}
        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
      >
        <option value="">Select staff…</option>
        {staffOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName}
          </option>
        ))}
        <option value="__freelancer__">Freelancer…</option>
      </select>
      {isFreelancer && (
        <input
          value={staffName}
          onChange={(e) => onChange({ staffId: null, staffName: e.target.value, isFreelancer: true })}
          placeholder="Freelancer name"
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
        />
      )}
    </div>
  );
}

function CreateClipModal({
  scheduleDate,
  staffOptions,
  diverIds,
  onClose,
  onCreated,
}: {
  scheduleDate: string;
  staffOptions: StaffOption[];
  diverIds: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showToast = useToast();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await createClip(scheduleDate, staffId, staffName, isFreelancer, diverIds);
      if (res.error) setError(res.error);
      else {
        if (res.merged) showToast(`Merged into ${staffName.trim()}'s existing clip for today.`);
        onCreated();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-lg text-navy">Create Team Clip</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5 grid gap-3">
          {error && <div className="text-sm text-red">{error}</div>}
          <div className="text-xs text-gray-500">{diverIds.length} diver(s) selected</div>
          <StaffPicker
            staffOptions={staffOptions}
            staffId={staffId}
            staffName={staffName}
            isFreelancer={isFreelancer}
            onChange={(v) => {
              setStaffId(v.staffId);
              setStaffName(v.staffName);
              setIsFreelancer(v.isFreelancer);
            }}
          />
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={pending || !staffName.trim()}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create Clip"}
          </button>
        </div>
      </div>
    </div>
  );
}

// A diver's compatibility at a glance — nationality/cert, dive count/age,
// and fun-diving-vs-course, matching the live app's real mini-cards
// (scheduling.html's diverLeftLine2/diverLeftLine3/diverExperienceLine) so
// a secretary can see who's suited to dive together without opening
// anything. An orange left accent flags course divers, same signal role
// as the old app's purple border (this codebase's palette has no purple).
// The group-name kicker line above the name mirrors scheduling.html's real
// .group-kicker — always reserves its line height (even when blank) so a
// secretary scanning 50+ divers can immediately tell group members from
// individuals without cards jumping size.
function DiverInfoCard({
  d,
}: {
  d: {
    firstName: string;
    lastName: string;
    certificationLevel: string;
    nationality: string | null;
    loggedDives: number;
    age: number | null;
    experienceType: "fun_diving" | "dive_course" | null;
    courseName?: string | null;
    groupName?: string | null;
  };
}) {
  const isCourse = d.experienceType === "dive_course";
  return (
    <div className={`pl-1.5 border-l-2 ${isCourse ? "border-orange" : "border-transparent"}`}>
      <div className="text-[0.68rem] uppercase tracking-wide text-teal-mid font-extrabold leading-tight min-h-[1rem]">
        {d.groupName || ""}
      </div>
      <div className="font-bold text-navy text-xs leading-none">
        {d.firstName} {d.lastName}
      </div>
      <div className="text-teal text-xs font-semibold leading-tight mt-0.5">
        {d.nationality || "Unknown"} ·{" "}
        {(d.certificationLevel && CERT_LEVEL_LABELS[d.certificationLevel]) || d.certificationLevel || "No cert"} ·{" "}
        {d.loggedDives} dive{d.loggedDives === 1 ? "" : "s"} · {d.age != null ? `${d.age}y` : "age n/a"}
      </div>
      {isCourse && (
        <div className="text-xs text-gray-500 leading-tight">
          Course{d.courseName ? ` - ${d.courseName}` : ""}
        </div>
      )}
    </div>
  );
}

function ClipMemberRow({
  clip,
  allClips,
  member,
  readOnly,
  scheduleDate,
  staffOptions,
  moving,
  onStartMove,
  onCancelMove,
  onChanged,
}: {
  clip: Clip;
  allClips: Clip[];
  member: ClipMember;
  readOnly: boolean;
  scheduleDate: string;
  staffOptions: StaffOption[];
  moving: boolean;
  onStartMove: () => void;
  onCancelMove: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [creatingNewTeam, setCreatingNewTeam] = useState(false);
  const [newStaffId, setNewStaffId] = useState<string | null>(null);
  const [newStaffName, setNewStaffName] = useState("");
  const [newIsFreelancer, setNewIsFreelancer] = useState(false);

  function clipLabel(c: Clip) {
    return c.source === "manual" ? c.staffName : `${c.staffName} (${c.source === "carryover" ? "carried over" : "returned"})`;
  }

  function confirmCreateNewTeam() {
    if (!newStaffName.trim()) return;
    startTransition(async () => {
      await moveDiverToNewClip(scheduleDate, member.diverId, clip.id, newStaffId, newStaffName, newIsFreelancer);
      setCreatingNewTeam(false);
      onCancelMove();
      onChanged();
    });
  }

  return (
    <div className={`rounded-md ${moving ? "bg-off-white" : ""}`}>
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="flex items-center gap-2">
          <DiverInfoCard d={member} />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onStartMove}
              className="px-2 py-1 text-xs font-medium text-navy border border-gray-200 rounded-md hover:bg-gray-100"
            >
              Move
            </button>
            <button
              onClick={() =>
                startTransition(async () => {
                  await excludeDiverFromClip(clip.id, member.diverId);
                  onChanged();
                })
              }
              disabled={pending}
              className="px-2 py-1 text-xs font-medium text-red border border-red/30 rounded-md hover:bg-red-light"
            >
              Exclude
            </button>
          </div>
        )}
      </div>

      {moving && !creatingNewTeam && (
        <div className="pl-2 pb-2 border-t border-gray-100 pt-2">
          <div className="text-xs text-gray-500 mb-1">
            Move {member.firstName} {member.lastName} to:
          </div>
          <div className="flex flex-wrap gap-1">
            {allClips
              .filter((c) => c.id !== clip.id)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    startTransition(async () => {
                      await moveDiverToClip(member.diverId, clip.id, c.id);
                      onCancelMove();
                      onChanged();
                    })
                  }
                  className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-100 bg-white"
                >
                  {clipLabel(c)}
                </button>
              ))}
            <button
              onClick={() => setCreatingNewTeam(true)}
              className="px-2 py-1 text-xs border border-teal/30 rounded-md hover:bg-teal-light bg-white text-teal"
            >
              + Create New Team
            </button>
            <button onClick={onCancelMove} className="px-2 py-1 text-xs text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {moving && creatingNewTeam && (
        <div className="pl-2 pb-2 border-t border-gray-100 pt-2">
          <div className="text-xs text-gray-500 mb-1">
            New team for {member.firstName} {member.lastName}:
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <StaffPicker
              staffOptions={staffOptions}
              staffId={newStaffId}
              staffName={newStaffName}
              isFreelancer={newIsFreelancer}
              onChange={(v) => {
                setNewStaffId(v.staffId);
                setNewStaffName(v.staffName);
                setNewIsFreelancer(v.isFreelancer);
              }}
            />
            <button
              onClick={confirmCreateNewTeam}
              disabled={pending || !newStaffName.trim()}
              className="px-2 py-1 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-60"
            >
              Confirm
            </button>
            <button onClick={() => setCreatingNewTeam(false)} className="px-2 py-1 text-xs text-gray-500">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClipCard({
  clip,
  allClips,
  staffOptions,
  scheduleDate,
  readOnly,
  onChanged,
}: {
  clip: Clip;
  allClips: Clip[];
  staffOptions: StaffOption[];
  scheduleDate: string;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [editingStaff, setEditingStaff] = useState(false);
  const [movingDiverId, setMovingDiverId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const showToast = useToast();
  // A manually excluded member moves down into PhaseOnePanel's Excluded
  // Divers section instead of rendering here. A diver whose bill is closed
  // is never even in clip.members at all (see fetchClipsRaw) — dropped
  // from Scheduling entirely, not merely hidden from the active list.
  const activeMembers = clip.members.filter((m) => !m.excluded);
  const activeCount = activeMembers.length;
  // Same mixed-cert-level check Phase 2's WarningsBanner does per team —
  // applies here regardless of whether the clip is led by named staff or a
  // freelancer, matching that same fix. Nitrox tank choice is a per-dive
  // decision made later in Phase 2, so there's no "mixed air" yet at this
  // stage — the closest available signal here is nitrox *certification*
  // mismatch within the group (worth flagging early, since it affects who
  // can even be offered nitrox once the trip is built).
  const clipWarnings: string[] = [];
  if (activeCount > 0) {
    const certs = new Set(activeMembers.map((m) => m.certificationLevel));
    const nitroxCertMix = new Set(activeMembers.map((m) => m.nitroxCertified));
    if (certs.size > 1) clipWarnings.push("Mixed certification levels in this team.");
    if (nitroxCertMix.size > 1) clipWarnings.push("Mixed Nitrox certification in this team.");
  }

  function saveStaff(v: { staffId: string | null; staffName: string; isFreelancer: boolean }) {
    startTransition(async () => {
      const res = await updateClipStaff(clip.id, v.staffId, v.staffName, v.isFreelancer);
      if (res.merged) showToast(`Merged into ${v.staffName.trim()}'s existing clip.`);
      setEditingStaff(false);
      onChanged();
    });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        {editingStaff ? (
          <div className="flex-1 mr-2">
            <StaffPicker
              staffOptions={staffOptions}
              staffId={clip.staffId}
              staffName={clip.staffName}
              isFreelancer={clip.isFreelancer}
              onChange={saveStaff}
            />
          </div>
        ) : (
          <button
            disabled={readOnly}
            onClick={() => setEditingStaff(true)}
            className="text-sm font-medium text-navy hover:underline text-left"
          >
            {clip.staffName}
            {clip.isFreelancer && <span className="ml-2 text-xs text-gray-400">(Freelancer)</span>}
            {clip.source === "carryover" && (
              <span className="ml-2 text-xs bg-teal-light text-teal-mid px-1.5 py-0.5 rounded-full">Carried over</span>
            )}
            <span className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full ${ratioBadgeClass(activeCount)}`}>
              {activeCount}/4
            </span>
          </button>
        )}
        {!readOnly && (
          <button
            onClick={async () => {
              if (await confirm("Delete this clip? Members return to the loose pool.", { danger: true }))
                startTransition(async () => {
                  await deleteClip(clip.id);
                  onChanged();
                });
            }}
            disabled={pending}
            className="px-2 py-1 text-xs font-medium text-red border border-red/30 rounded-md hover:bg-red-light"
          >
            Delete
          </button>
        )}
      </div>
      <div className="grid gap-1 divide-y divide-gray-100">
        {activeMembers.map((m) => (
          <ClipMemberRow
            key={m.diverId}
            clip={clip}
            allClips={allClips}
            member={m}
            readOnly={readOnly}
            scheduleDate={scheduleDate}
            staffOptions={staffOptions}
            moving={movingDiverId === m.diverId}
            onStartMove={() => setMovingDiverId(m.diverId)}
            onCancelMove={() => setMovingDiverId(null)}
            onChanged={onChanged}
          />
        ))}
        {activeMembers.length === 0 && (
          <div className="text-xs text-gray-400 py-1">
            No divers currently scheduled here — see Excluded Divers below.
          </div>
        )}
      </div>
      {clipWarnings.map((w, i) => (
        <div
          key={i}
          className="text-xs text-orange bg-orange-light border border-orange/20 rounded-md px-2 py-1 mt-2"
        >
          ⚠️ {w}
        </div>
      ))}
    </div>
  );
}

function ExcludedDiverRow({
  name,
  context,
  onInclude,
  readOnly,
}: {
  name: string;
  context?: string;
  onInclude: () => void;
  readOnly: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
      <div className="min-w-0 text-gray-600 truncate">
        {name}
        {context && <span className="text-gray-400"> — {context}</span>}
      </div>
      {!readOnly && (
        <button
          onClick={onInclude}
          className="shrink-0 px-2 py-1 text-xs font-medium text-teal border border-teal/30 rounded-md hover:bg-teal-light"
        >
          Include
        </button>
      )}
    </div>
  );
}

// Third Phase 1 section, below Suggested Clips — collapsed by default since
// this is meant to stay out of the way for the common 50+-diver case. Only
// ever holds a diver a staff member explicitly excluded for the day (loose)
// or from a specific clip — a closed bill drops a diver from Scheduling
// entirely instead (see data.ts's fetchClipsRaw/loadReadyPool), with no
// resting place here at all; they only come back via a fresh open visit
// (Divers page push-to-schedule, or a new visit started from Diver Form).
function ExcludedDiversSection({
  data,
  readOnly,
  scheduleDate,
  refresh,
}: {
  data: PhaseOneData;
  readOnly: boolean;
  scheduleDate: string;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const total = data.excludedDivers.length + data.excludedClipMembers.length;
  if (total === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-semibold text-navy mb-2"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        Excluded Divers ({total})
      </button>
      {open && (
        <div className="grid gap-1.5">
          {data.excludedDivers.map((d) => (
            <ExcludedDiverRow
              key={`loose-${d.id}`}
              name={`${d.firstName} ${d.lastName}`}
              readOnly={readOnly}
              onInclude={() =>
                startTransition(async () => {
                  await includeDiverForDay(d.id, scheduleDate);
                  refresh();
                })
              }
            />
          ))}
          {data.excludedClipMembers.map((m) => (
            <ExcludedDiverRow
              key={`clip-${m.clipId}-${m.diverId}`}
              name={`${m.firstName} ${m.lastName}`}
              context={`${m.clipStaffName}'s clip`}
              readOnly={readOnly}
              onInclude={() =>
                startTransition(async () => {
                  await includeDiverInClip(m.clipId, m.diverId);
                  refresh();
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PhaseOnePanel({
  scheduleDate,
  staffOptions,
  readOnly,
  onNext,
}: {
  scheduleDate: string;
  staffOptions: StaffOption[];
  readOnly: boolean;
  onNext: () => void;
}) {
  const [data, setData] = useState<PhaseOneData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreateClip, setShowCreateClip] = useState(false);
  const [, startTransition] = useTransition();
  const confirm = useConfirm();

  function refresh() {
    getPhaseOneData(scheduleDate).then(setData);
  }

  // scheduleDate changes remount this component entirely (SchedulingClient
  // renders it with key={date}), so this only ever needs to run once per
  // mount — no manual state reset needed here.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return <div className="text-center text-gray-400 text-sm py-8">Loading…</div>;
  }

  // A clip with zero members left (its last member's bill closed, or every
  // member was manually excluded) is an empty card with nothing to show —
  // matches TripCard.tsx's own "+ Add Team" picker, which already drops a
  // clip once .members.length is 0. The clip row itself isn't deleted (a
  // manually-excluded member's "Include" button still needs it to exist),
  // it's just not worth a card here. allClips (used by Move) still passes
  // the unfiltered data.clips so a diver can be moved into one of these.
  const visibleClips = data.clips.filter((c) => c.members.length > 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleNext() {
    if (data!.looseDivers.length > 0) {
      const names = data!.looseDivers
        .slice(0, 12)
        .map((d) => `${d.firstName} ${d.lastName}`)
        .join(", ");
      const more = data!.looseDivers.length > 12 ? ` and ${data!.looseDivers.length - 12} more` : "";
      const ok = await confirm(
        `${data!.looseDivers.length} diver(s) still aren't in a team clip: ${names}${more}. Continue to Build anyway?`,
      );
      if (!ok) return;
    }
    onNext();
  }

  return (
    <div className="grid gap-6">
      {/* Two full-width rows — Loose Divers on top, Suggested Clips below —
          matching scheduling.html's real .phase-one-shell (two stacked
          .phase-section blocks), not a side-by-side sidebar layout. */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-navy">Loose Divers ({data.looseDivers.length})</h3>
          {!readOnly && selected.size > 0 && (
            <Button variant="primary" size="sm" onClick={() => setShowCreateClip(true)}>
              Add to Clip ({selected.size})
            </Button>
          )}
        </div>
        {data.looseDivers.length === 0 ? (
          <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4 text-center">
            No loose divers — everyone ready today is in a clip.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.looseDivers.map((d: DiverPickResult) => (
              <label
                key={d.id}
                className={`flex flex-col gap-1.5 border rounded-lg px-3 py-2 text-sm cursor-pointer ${
                  selected.has(d.id) ? "border-navy bg-off-white" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <DiverInfoCard d={{ ...d, experienceType: d.openVisitExperienceType }} />
                  {!readOnly && (
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggle(d.id)}
                      className="mt-0.5 shrink-0"
                    />
                  )}
                </div>
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      startTransition(async () => {
                        await excludeDiverForDay(d.id, scheduleDate);
                        refresh();
                      });
                    }}
                    className="self-start px-2 py-1 text-xs text-gray-400 border border-gray-200 rounded-md hover:text-red hover:border-red/30"
                  >
                    Not diving today
                  </button>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-navy mb-2">Suggested Clips ({visibleClips.length})</h3>
        {visibleClips.length === 0 ? (
          <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4 text-center">
            No clips yet — select loose divers above and create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleClips.map((c) => (
              <ClipCard
                key={c.id}
                clip={c}
                allClips={data.clips}
                staffOptions={staffOptions}
                scheduleDate={scheduleDate}
                readOnly={readOnly}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>

      <ExcludedDiversSection data={data} readOnly={readOnly} scheduleDate={scheduleDate} refresh={refresh} />

      {!readOnly && (
        <div className="flex justify-end">
          <Button variant="secondary" size="md" onClick={handleNext}>
            Next →
          </Button>
        </div>
      )}

      {showCreateClip && (
        <CreateClipModal
          scheduleDate={scheduleDate}
          staffOptions={staffOptions}
          diverIds={[...selected]}
          onClose={() => setShowCreateClip(false)}
          onCreated={() => {
            setSelected(new Set());
            refresh();
          }}
        />
      )}
    </div>
  );
}
