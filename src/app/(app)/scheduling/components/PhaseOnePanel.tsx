"use client";

import { useEffect, useState, useTransition } from "react";
import type { StaffOption, Clip, DiverPickResult, PhaseOneData } from "../data";
import {
  getPhaseOneData,
  createClip,
  excludeDiverFromClip,
  moveDiverToClip,
  deleteClip,
  updateClipStaff,
  excludeDiverForDay,
  includeDiverForDay,
} from "../actions";

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

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await createClip(scheduleDate, staffId, staffName, isFreelancer, diverIds);
      if (res.error) setError(res.error);
      else {
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

function ClipCard({
  clip,
  allClips,
  staffOptions,
  readOnly,
  onChanged,
}: {
  clip: Clip;
  allClips: Clip[];
  staffOptions: StaffOption[];
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [editingStaff, setEditingStaff] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const members = clip.members.filter((m) => !m.excluded);

  function saveStaff(v: { staffId: string | null; staffName: string; isFreelancer: boolean }) {
    startTransition(async () => {
      await updateClipStaff(clip.id, v.staffId, v.staffName, v.isFreelancer);
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
              <span className="ml-2 text-xs bg-teal/10 text-teal px-1.5 py-0.5 rounded-full">Carried over</span>
            )}
          </button>
        )}
        {!readOnly && (
          <button
            onClick={() => {
              if (window.confirm("Delete this clip? Members return to the loose pool."))
                startTransition(async () => {
                  await deleteClip(clip.id);
                  onChanged();
                });
            }}
            disabled={pending}
            className="text-xs text-red hover:underline"
          >
            Delete
          </button>
        )}
      </div>
      <div className="grid gap-1">
        {members.map((m) => (
          <div key={m.diverId} className="flex items-center justify-between text-xs">
            <span className="text-gray-700">
              {m.firstName} {m.lastName} <span className="text-gray-400">({m.certificationLevel})</span>
            </span>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <button onClick={() => setMoving(m.diverId)} className="text-navy hover:underline">
                  Move
                </button>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      await excludeDiverFromClip(clip.id, m.diverId);
                      onChanged();
                    })
                  }
                  className="text-red hover:underline"
                >
                  Exclude
                </button>
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && <div className="text-xs text-gray-400">No divers.</div>}
      </div>

      {moving && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="text-xs text-gray-500 mb-1">Move to:</div>
          <div className="flex flex-wrap gap-1">
            {allClips
              .filter((c) => c.id !== clip.id)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    startTransition(async () => {
                      await moveDiverToClip(moving, clip.id, c.id);
                      setMoving(null);
                      onChanged();
                    })
                  }
                  className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  {c.staffName}
                </button>
              ))}
            <button onClick={() => setMoving(null)} className="px-2 py-1 text-xs text-gray-500">
              Cancel
            </button>
          </div>
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleNext() {
    if (data!.looseDivers.length > 0) {
      const names = data!.looseDivers
        .slice(0, 12)
        .map((d) => `${d.firstName} ${d.lastName}`)
        .join(", ");
      const more = data!.looseDivers.length > 12 ? ` and ${data!.looseDivers.length - 12} more` : "";
      if (
        !window.confirm(
          `${data!.looseDivers.length} diver(s) still aren't in a team clip: ${names}${more}. Continue to Build anyway?`,
        )
      )
        return;
    }
    onNext();
  }

  return (
    <div className="grid gap-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-navy">Loose Divers ({data.looseDivers.length})</h3>
          {!readOnly && selected.size > 0 && (
            <button
              onClick={() => setShowCreateClip(true)}
              className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark"
            >
              Add to Clip ({selected.size})
            </button>
          )}
        </div>
        {data.looseDivers.length === 0 ? (
          <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4 text-center">
            No loose divers — everyone ready today is in a clip.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.looseDivers.map((d: DiverPickResult) => (
              <label
                key={d.id}
                className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${
                  selected.has(d.id) ? "border-navy bg-off-white" : "border-gray-200"
                }`}
              >
                {!readOnly && (
                  <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                )}
                <span className="flex-1">
                  {d.firstName} {d.lastName}
                  {d.groupName && <span className="text-gray-400"> · {d.groupName}</span>}
                </span>
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      startTransition(async () => {
                        await excludeDiverForDay(d.id, scheduleDate);
                        refresh();
                      });
                    }}
                    className="text-xs text-gray-400 hover:text-red"
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
        <h3 className="text-sm font-semibold text-navy mb-2">Suggested Clips ({data.clips.length})</h3>
        {data.clips.length === 0 ? (
          <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4 text-center">
            No clips yet — select loose divers above and create one.
          </div>
        ) : (
          <div className="grid gap-2">
            {data.clips.map((c) => (
              <ClipCard
                key={c.id}
                clip={c}
                allClips={data.clips}
                staffOptions={staffOptions}
                readOnly={readOnly}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>

      {data.excludedDivers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy mb-2">
            Not Diving Today ({data.excludedDivers.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.excludedDivers.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-500"
              >
                <span>
                  {d.firstName} {d.lastName}
                </span>
                {!readOnly && (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await includeDiverForDay(d.id, scheduleDate);
                        refresh();
                      })
                    }
                    className="text-xs text-teal hover:underline"
                  >
                    Include
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors"
          >
            Next →
          </button>
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
