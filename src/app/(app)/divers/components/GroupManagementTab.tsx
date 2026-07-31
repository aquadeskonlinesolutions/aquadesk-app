"use client";

import { useEffect, useState, useTransition } from "react";
import type { GroupSummary, DiverCard as DiverCardType, CourseRateOption } from "../data";
import {
  getGroups,
  getGroupMembers,
  getGroupDeletionBlockers,
  createRegistrationLinkGroup,
  deleteGroup,
  addDiversToSchedule,
  removeDiver,
  acknowledgeMedical,
} from "../actions";
import { DiverCard } from "./DiverCard";
import { ExperienceTagModal, type PendingTag } from "./ExperienceTagModal";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export function GroupManagementTab({
  courseRates,
  diveCenterId,
  active,
}: {
  courseRates: CourseRateOption[];
  diveCenterId: string;
  active: boolean;
}) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<DiverCardType[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingTagDivers, setPendingTagDivers] = useState<DiverCardType[] | null>(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({
    groupName: "",
    leaderName: "",
    arrivalDate: "",
    departureDate: "",
    expectedCount: "",
    notes: "",
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const confirm = useConfirm();

  function refreshGroups() {
    startTransition(async () => setGroups(await getGroups()));
  }

  // Group Management stays mounted (never conditionally unmounted) while
  // switching tabs, per this codebase's standing rule against local
  // mutation state getting lost on remount (see the Reports tab-remount
  // lessons). But that means it must explicitly refetch whenever it
  // becomes the visible tab again, since Individual Management's ad-hoc
  // group flow can create groups this component's own local `groups`
  // state has no way of knowing about otherwise.
  useEffect(() => {
    if (active) refreshGroups();
  }, [active]);

  function openGroup(groupId: string) {
    setOpenGroupId(groupId);
    setSelected(new Set());
    startTransition(async () => setMembers(await getGroupMembers(groupId)));
  }

  function createLinkGroup() {
    setError(null);
    startTransition(async () => {
      const res = await createRegistrationLinkGroup(linkForm);
      if (res.error) setError(res.error);
      else {
        setGeneratedLink(res.registrationLink ?? null);
        refreshGroups();
      }
    });
  }

  function remove(groupId: string, groupName: string) {
    startTransition(async () => {
      const blockers = await getGroupDeletionBlockers(groupId);
      if (blockers.length > 0) {
        setError(
          `Can't delete "${groupName}" — ${blockers.map((b) => `${b.diverName} (${b.reasons.join(", ")})`).join("; ")}.`,
        );
        return;
      }
      if (!(await confirm(`Delete "${groupName}"? This can't be undone.`, { danger: true }))) return;
      const res = await deleteGroup(groupId);
      if (res.error) setError(res.error);
      else {
        if (openGroupId === groupId) setOpenGroupId(null);
        refreshGroups();
      }
    });
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // "Select All" only ever selects the divers whose checkbox is actually
  // selectable (DiverCard disables the box for alreadyInScheduling divers)
  // — matches the same guard the checkboxes themselves already enforce.
  function selectableIds(list: DiverCardType[]): string[] {
    return list.filter((m) => !m.alreadyInScheduling).map((m) => m.id);
  }

  function allSelectableSelected(list: DiverCardType[]): boolean {
    const ids = selectableIds(list);
    return ids.length > 0 && ids.every((id) => selected.has(id));
  }

  function toggleSelectAll(list: DiverCardType[]) {
    setSelected(allSelectableSelected(list) ? new Set() : new Set(selectableIds(list)));
  }

  function openAddToSchedule() {
    setPendingTagDivers(members.filter((m) => selected.has(m.id)));
  }

  function confirmAddToSchedule(tags: PendingTag[]) {
    startTransition(async () => {
      const res = await addDiversToSchedule(
        tags.map((t) => ({ diverId: t.diverId, experienceType: t.experienceType, courseRateId: t.courseRateId })),
      );
      if (res.error) setError(res.error);
      else {
        setPendingTagDivers(null);
        setSelected(new Set());
        if (openGroupId) openGroup(openGroupId);
      }
    });
  }

  async function removeMember(diverId: string, name: string) {
    const ok = await confirm(
      `Remove ${name}? This deletes their diver record entirely and cannot be undone. If this was a mistake, they'll need to re-register.`,
      { danger: true },
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await removeDiver(diverId);
      if (res.error) setError(res.error);
      else {
        refreshGroups();
        if (openGroupId) openGroup(openGroupId);
      }
    });
  }

  function ackMedical(diverId: string) {
    startTransition(async () => {
      await acknowledgeMedical(diverId);
      if (openGroupId) openGroup(openGroupId);
    });
  }

  return (
    <div className="grid gap-4">
      {error && <div className="text-sm text-red bg-red-light rounded-md px-3 py-2">{error}</div>}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowLinkForm((v) => !v)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-navy text-white hover:bg-navy-dark"
        >
          + Create Group Link
        </button>
      </div>

      {showLinkForm && (
        <div className="border border-gray-200 rounded-lg p-3 grid gap-2 bg-white">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Group name"
              value={linkForm.groupName}
              onChange={(e) => setLinkForm({ ...linkForm, groupName: e.target.value })}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            />
            <input
              placeholder="Leader name"
              value={linkForm.leaderName}
              onChange={(e) => setLinkForm({ ...linkForm, leaderName: e.target.value })}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            />
            <input
              type="date"
              value={linkForm.arrivalDate}
              onChange={(e) => setLinkForm({ ...linkForm, arrivalDate: e.target.value })}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            />
            <input
              type="date"
              value={linkForm.departureDate}
              onChange={(e) => setLinkForm({ ...linkForm, departureDate: e.target.value })}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            />
            <input
              type="number"
              placeholder="Expected count"
              value={linkForm.expectedCount}
              onChange={(e) => setLinkForm({ ...linkForm, expectedCount: e.target.value })}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            />
            <input
              placeholder="Notes"
              value={linkForm.notes}
              onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            />
          </div>
          <button
            onClick={createLinkGroup}
            disabled={pending}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-navy text-white hover:bg-navy-dark w-fit"
          >
            Create Group + Link
          </button>
          {generatedLink && (
            <div className="text-xs bg-off-white border border-gray-200 rounded-md p-2 break-all">{generatedLink}</div>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">No groups yet.</div>
      ) : (
        <div className="grid gap-2">
          {groups.map((g) => (
            <div key={g.id} className="border border-teal/20 rounded-lg bg-teal-light">
              <div className="p-3 flex items-center justify-between gap-2">
                <button className="text-left flex-1" onClick={() => openGroup(g.id)}>
                  <div className="text-sm font-semibold text-navy">{g.groupName}</div>
                  <div className="text-xs text-gray-400">
                    {g.leaderName ? `${g.leaderName} · ` : ""}
                    {g.memberCount}
                    {g.expectedCount ? `/${g.expectedCount}` : ""} registered
                    {g.arrivalDate ? ` · arrives ${g.arrivalDate}` : ""}
                  </div>
                </button>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => (openGroupId === g.id ? setOpenGroupId(null) : openGroup(g.id))}
                    className="px-2 py-1 text-xs font-medium text-navy border border-navy/20 rounded-md bg-white hover:bg-gray-50"
                  >
                    {openGroupId === g.id ? "Collapse" : "Expand"}
                  </button>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(`${window.location.origin}/register?dc=${diveCenterId}&group=${g.id}`)
                    }
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Copy Link
                  </button>
                  <button onClick={() => remove(g.id, g.groupName)} disabled={pending} className="text-xs text-red hover:underline">
                    Delete
                  </button>
                </div>
              </div>

              {openGroupId === g.id && (
                <div className="border-t border-gray-200 p-3 grid gap-3">
                  {members.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-4">No members yet.</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between bg-off-white rounded-md px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleSelectAll(members)}
                          className="text-xs text-teal font-medium hover:underline"
                        >
                          {allSelectableSelected(members) ? "Clear Selection" : "Select All"}
                        </button>
                        {selected.size > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">{selected.size} selected</span>
                            <button
                              onClick={openAddToSchedule}
                              className="px-3 py-1 text-xs font-medium rounded-md bg-teal text-white hover:bg-teal-mid"
                            >
                              Add to Schedule
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {members.map((m) => (
                          <DiverCard
                            key={m.id}
                            card={m}
                            variant="group-member"
                            selected={selected.has(m.id)}
                            onToggleSelect={(checked) => toggleSelect(m.id, checked)}
                            showRemove
                            onRemove={() => removeMember(m.id, `${m.firstName} ${m.lastName}`)}
                            onAcknowledgeMedical={() => ackMedical(m.id)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingTagDivers && (
        <ExperienceTagModal
          divers={pendingTagDivers}
          courseRates={courseRates}
          pending={pending}
          onClose={() => setPendingTagDivers(null)}
          onConfirm={confirmAddToSchedule}
        />
      )}
    </div>
  );
}
